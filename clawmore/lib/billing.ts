import Stripe from 'stripe';
import { Resource } from 'sst';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_dummy_123', {
      apiVersion: '2025-01-27-acacia' as any,
    });
  }
  return stripeClient;
}

/**
 * Creates a Stripe Checkout Session for the $29.00/mo Platform Subscription.
 * This also authorizes the 'off_session' auto-recharges for AI tokens.
 */
export interface PlatformSubscriptionOpts {
  customerId?: string;
  userEmail: string;
  coEvolutionOptIn?: boolean;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a Stripe Checkout Session for the $29.00/mo Platform Subscription.
 * Accepts an options object to avoid positional boolean traps.
 */
export async function createPlatformSubscriptionSession(
  opts: PlatformSubscriptionOpts
) {
  const {
    customerId,
    userEmail,
    coEvolutionOptIn = false,
    successUrl,
    cancelUrl,
  } = opts;

  // Use the linked price ID from SST if it exists
  const priceId = (Resource as any).PlatformPrice?.id;

  return await getStripe().checkout.sessions.create({
    customer: customerId,
    customer_email: customerId ? undefined : userEmail,
    payment_method_types: ['card'],
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'ClawMore Managed Platform Subscription',
                description:
                  '$29.00/mo for managed serverless infrastructure + AI evolution guardrails.',
              },
              unit_amount: 2900,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
    ],
    mode: 'subscription',
    payment_intent_data: {
      setup_future_usage: 'off_session', // CRITICAL: Authorizes auto-recharges
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: 'platform_subscription',
      coEvolutionOptIn: coEvolutionOptIn ? 'true' : 'false',
      userEmail,
    },
    subscription_data: {
      description: `ClawMore Managed - ${userEmail}`,
      metadata: {
        coEvolutionOptIn: coEvolutionOptIn ? 'true' : 'false',
        userEmail,
      },
    },
  });
}

/**
 * Reports usage for a metered subscription item (e.g., the Evolution Tax).
 */
export async function reportMeteredUsage(
  subscriptionItemId: string,
  quantity: number = 1
) {
  try {
    await (getStripe().subscriptionItems as any).createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment',
      }
    );
    console.log(
      `Reported metered usage (${quantity}) for ${subscriptionItemId}`
    );
  } catch (error) {
    console.error('Error reporting metered usage to Stripe:', error);
    throw error;
  }
}

/**
 * Adds a one-time charge (invoice item) to the customer's next invoice.
 */
export async function reportOverageCharge(
  customerId: string,
  amountInCents: number,
  description: string
) {
  try {
    await getStripe().invoiceItems.create({
      customer: customerId,
      amount: amountInCents,
      currency: 'usd',
      description,
    });
    console.log(
      `Reported overage charge of $${(amountInCents / 100).toFixed(2)} for ${customerId}`
    );
  } catch (error) {
    console.error('Error reporting overage charge to Stripe:', error);
    throw error;
  }
}

/**
 * Creates a Stripe Checkout Session for a pre-paid "AI Fuel Pack".
 */
export async function createFuelPackCheckout(
  customerId: string,
  successUrl: string,
  cancelUrl: string
) {
  // Use the linked price ID from SST if it exists
  const priceId = (Resource as any).FuelPackPrice?.id;

  return await getStripe().checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'ClawMore AI Fuel Pack ($10.00)',
                description: 'Adds $10.00 to your pre-paid AI token balance.',
              },
              unit_amount: 1000,
            },
            quantity: 1,
          },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: 'fuel_pack_refill',
      amountCents: '1000',
    },
  });
}
