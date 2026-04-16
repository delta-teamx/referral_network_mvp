import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { eventBus } from '../core/events/index.js';

/**
 * Stripe webhook handler. Mounted at `POST /api/v1/billing/webhook` using
 * the raw-body middleware (required for signature verification) so it runs
 * BEFORE express.json() in index.ts.
 *
 * Handles:
 *   - checkout.session.completed → activate subscription
 *   - customer.subscription.updated → sync tier + status
 *   - customer.subscription.deleted → downgrade to FREE
 *
 * Idempotent by event ID: each event is recorded once in DomainEvent so
 * Stripe retries don't double-apply the effect.
 */

type TierName = 'FREE' | 'PRO' | 'PREMIUM';

function priceIdToTier(priceId: string | undefined): TierName {
  if (!priceId) return 'FREE';
  if (env.STRIPE_PRO_PRICE_ID && priceId === env.STRIPE_PRO_PRICE_ID) return 'PRO';
  if (env.STRIPE_PREMIUM_PRICE_ID && priceId === env.STRIPE_PREMIUM_PRICE_ID) return 'PREMIUM';
  return 'FREE';
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = env.STRIPE_SECRET_KEY;
  const whSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    res.status(503).json({ success: false, error: 'Stripe webhook not configured' });
    return;
  }

  // @ts-expect-error — stripe SDK is optional.
  const stripeMod = await import('stripe').catch(() => null);
  if (!stripeMod) {
    res.status(503).json({ success: false, error: 'Stripe SDK not installed' });
    return;
  }
  const Stripe = stripeMod.default;
  const stripe = new Stripe(secret);

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    res.status(400).json({ success: false, error: 'Missing stripe-signature header' });
    return;
  }

  // req.body here must be the raw Buffer — see the route mount in index.ts.
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, whSecret);
  } catch (err) {
    res
      .status(400)
      .json({ success: false, error: `Signature verification failed: ${(err as Error).message}` });
    return;
  }

  // Idempotency: skip if we've processed this event id before.
  try {
    await prisma.domainEvent.create({
      data: {
        id: event.id,
        type: `stripe.${event.type}`,
        aggregateId: event.data.object && (event.data.object as { id?: string }).id ? String((event.data.object as { id: string }).id) : event.id,
        payload: event as unknown as object,
      },
    });
  } catch {
    // Unique violation → duplicate event, ack and move on.
    res.json({ received: true, duplicate: true });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          metadata?: { userId?: string; tier?: string };
          customer?: string;
          subscription?: string;
        };
        const userId = session.metadata?.userId;
        const tier = (session.metadata?.tier ?? 'PRO') as TierName;
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionTier: tier,
              stripeCustomerId: (session.customer as string) ?? undefined,
            },
          });
          await eventBus.publish('subscription.activated', { userId, tier });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as {
          customer?: string;
          status?: string;
          items?: { data?: Array<{ price?: { id?: string } }> };
        };
        const customerId = sub.customer as string | undefined;
        if (!customerId) break;
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        });
        if (!user) break;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const tier = priceIdToTier(priceId);
        const active = sub.status === 'active' || sub.status === 'trialing';
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionTier: active ? tier : 'FREE' },
        });
        if (!active) {
          await eventBus.publish('subscription.canceled', { userId: user.id });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as { customer?: string };
        const customerId = sub.customer as string | undefined;
        if (!customerId) break;
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        });
        if (!user) break;
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionTier: 'FREE' },
        });
        await eventBus.publish('subscription.canceled', { userId: user.id });
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as { customer?: string };
        const customerId = inv.customer as string | undefined;
        if (!customerId) break;
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        });
        if (user) {
          await eventBus.publish('subscription.payment_failed', { userId: user.id });
        }
        break;
      }
      default:
        // Unhandled event type — ack anyway so Stripe stops retrying.
        break;
    }
    res.json({ received: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[stripe:webhook] processing error', err);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
}
