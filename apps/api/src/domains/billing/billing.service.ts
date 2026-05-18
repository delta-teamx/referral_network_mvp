import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { eventBus } from '../core/events/index.js';
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

export async function finaliseUpgrade(userId: string, tier: Tier): Promise<void> {
  if (tier === 'FREE') return;
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionTier: tier },
  });
  await eventBus.publish('subscription.activated', { userId, tier });
}
