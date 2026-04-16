import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { eventBus } from '../core/events/index.js';
import { TIERS, type Tier } from './billing.tiers.js';

/**
 * Stripe checkout session creation. Kept dependency-free of the Stripe SDK
 * here so the app boots without STRIPE_SECRET_KEY set. When the env var IS
 * set, we lazy-load the SDK and hit the real API. When it's not, we return
 * a deterministic fake URL so the frontend flow is demoable end-to-end.
 */

export interface CheckoutSessionResult {
  url: string;
  demo: boolean;
}

export async function createCheckoutSession(
  userId: string,
  tier: Tier,
): Promise<CheckoutSessionResult> {
  if (tier === 'FREE') throw AppError.badRequest('No checkout for FREE tier');
  const plan = TIERS[tier];
  const priceKey = plan.stripePriceIdEnvKey;
  if (!priceKey) throw AppError.badRequest('Tier is not purchasable');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true },
  });
  if (!user) throw AppError.notFound('User not found');

  const priceId = env[priceKey];
  const secretKey = env.STRIPE_SECRET_KEY;

  // Demo mode: no Stripe credentials → return a mock URL that lands the user
  // on our own /billing/success page as if they'd paid. Simplifies preview
  // deploys and developer workflow.
  if (!secretKey || !priceId) {
    const fakeUrl = `${env.FRONTEND_URL.split(',')[0]}/billing/success?tier=${tier}&demo=1`;
    await eventBus.publish('subscription.activated', { userId, tier });
    return { url: fakeUrl, demo: true };
  }

  // Real Stripe: lazy-import so we don't require the SDK unless configured.
  // @ts-expect-error — stripe is an optional runtime dependency; tsc shouldn't
  // demand its types when the import is dynamically gated.
  const StripeModule = await import('stripe').catch(() => null);
  if (!StripeModule) {
    throw AppError.badRequest('Stripe SDK not installed but STRIPE_SECRET_KEY is set');
  }
  const Stripe = StripeModule.default;
  const stripe = new Stripe(secretKey);

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const origin = env.FRONTEND_URL.split(',')[0];
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/billing/success?tier=${tier}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?canceled=1`,
    metadata: { userId: user.id, tier },
  });

  if (!session.url) throw AppError.badRequest('Stripe did not return a checkout URL');
  return { url: session.url, demo: false };
}

/**
 * Demo-mode "finalise": used by the frontend success page when Stripe is
 * not configured. Flips the user to the purchased tier so the UI can show
 * unlocked features. Real Stripe would do this via webhook instead.
 */
export async function finaliseDemoUpgrade(userId: string, tier: Tier): Promise<void> {
  if (tier === 'FREE') return;
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionTier: tier },
  });
  await eventBus.publish('subscription.activated', { userId, tier });
}
