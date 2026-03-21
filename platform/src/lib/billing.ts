import Stripe from 'stripe';
import { Resource } from 'sst';

let stripe: Stripe | null = null;

/**
 * Lazy-initialize Stripe client
 */
export function getStripe(): Stripe | null {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover' as any, // Cast as any if the version is not in the types yet
    });
  }
  return stripe;
}

/**
 * Common billing utility for plan determination
 */
export function determinePlan(session: {
  amount_total?: number | null;
  metadata?: { plan?: string } | null;
}): 'pro' | 'team' {
  const planFromMetadata = session.metadata?.plan;
  if (planFromMetadata === 'team') {
    return 'team';
  } else if (session.amount_total && session.amount_total >= 9900) {
    return 'team';
  }
  return 'pro';
}

/**
 * Create a Stripe Checkout Session for upgrading a team or user
 */
export async function createCheckoutSession(
  teamId: string,
  plan: 'pro' | 'team',
  userEmail: string,
  successUrl: string,
  cancelUrl: string
) {
  const stripeClient = getStripe();
  if (!stripeClient) throw new Error('Stripe not configured');

  const prices: Record<string, string> = {
    pro: (Resource as any).ProPrice?.id || process.env.STRIPE_PRICE_ID_PRO || '',
    team: (Resource as any).TeamPrice?.id || process.env.STRIPE_PRICE_ID_TEAM || '',
  };

  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: prices[plan],
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: userEmail,
    metadata: {
      teamId,
      plan,
    },
    subscription_data: {
      metadata: {
        teamId,
        plan,
      },
    },
  });

  return session;
}

/**
 * Create a Stripe Customer Portal Session
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
) {
  const stripeClient = getStripe();
  if (!stripeClient) throw new Error('Stripe not configured');

  const session = await stripeClient.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}
