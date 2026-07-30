import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { TIERS, type Tier } from './billing.tiers.js';

export interface CheckoutSessionResult {
  url: string;
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

  if (!secretKey) throw AppError.badRequest('Stripe is not configured. Contact support.');
  if (!priceId) throw AppError.badRequest(`Price not configured for ${tier} plan. Contact support.`);

  const StripeModule = await import('stripe').catch(() => null);
  if (!StripeModule) throw AppError.badRequest('Stripe SDK not available');
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
    cancel_url: `${origin}/dashboard/billing?canceled=1`,
    metadata: { userId: user.id, tier },
  });

  if (!session.url) throw AppError.badRequest('Stripe did not return a checkout URL');
  return { url: session.url };
}

export interface BillingStatus {
  tier: string;
  pastDue: boolean;
  pausedTier?: string;
  payUrl?: string | null;
}

// Small cache so the dashboard banner's poll doesn't hammer Stripe.
const statusCache = new Map<string, { at: number; data: BillingStatus }>();
const STATUS_TTL_MS = 60_000;

/**
 * Live billing state for the signed-in member, straight from Stripe: if any
 * of their subscriptions is past_due/unpaid the plan is PAUSED and we return
 * the hosted-invoice link so they can pay the dues and resume instantly.
 */
export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const cached = statusCache.get(userId);
  if (cached && Date.now() - cached.at < STATUS_TTL_MS) return cached.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, stripeCustomerId: true },
  });
  if (!user) throw AppError.notFound('User not found');
  const base: BillingStatus = { tier: user.subscriptionTier, pastDue: false };

  if (!user.stripeCustomerId || !env.STRIPE_SECRET_KEY) {
    statusCache.set(userId, { at: Date.now(), data: base });
    return base;
  }

  try {
    const StripeModule = await import('stripe');
    const stripe = new StripeModule.default(env.STRIPE_SECRET_KEY);
    const subs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 5,
    });
    const troubled = subs.data.find((s) =>
      ['past_due', 'unpaid', 'incomplete'].includes(s.status),
    );
    if (!troubled) {
      statusCache.set(userId, { at: Date.now(), data: base });
      return base;
    }

    const priceId = troubled.items.data[0]?.price?.id;
    const pausedTier =
      env.STRIPE_PREMIUM_PRICE_ID && priceId === env.STRIPE_PREMIUM_PRICE_ID
        ? 'PREMIUM'
        : 'PRO';

    let payUrl: string | null = null;
    const invoiceId =
      typeof troubled.latest_invoice === 'string'
        ? troubled.latest_invoice
        : troubled.latest_invoice?.id;
    if (invoiceId) {
      const inv = await stripe.invoices.retrieve(invoiceId);
      payUrl = inv.hosted_invoice_url ?? null;
    }

    const data: BillingStatus = { tier: user.subscriptionTier, pastDue: true, pausedTier, payUrl };
    statusCache.set(userId, { at: Date.now(), data });
    return data;
  } catch {
    // Stripe hiccups must never break the dashboard - report no dues.
    return base;
  }
}

// finaliseUpgrade() was removed: it set a paid tier with no payment proof and
// was a free-upgrade bypass. Tier activation is now done only by the
// signature-verified Stripe webhook (billing.webhook.ts).
