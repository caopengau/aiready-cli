import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { mockStripeInstance } = vi.hoisted(() => {
  return {
    mockStripeInstance: {
      subscriptionItems: {
        createUsageRecord: vi.fn(),
      },
      invoiceItems: {
        create: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
    },
  };
});

vi.mock('stripe', () => {
  // Use a class for Stripe mock
  class MockStripe {
    subscriptionItems = mockStripeInstance.subscriptionItems;
    invoiceItems = mockStripeInstance.invoiceItems;
    checkout = mockStripeInstance.checkout;
    constructor() {}
  }
  return {
    default: MockStripe,
  };
});

import { reportMeteredUsage, reportOverageCharge } from './billing';

describe('billing library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call Stripe to report metered usage', async () => {
    const subItemId = 'si_123';
    const quantity = 5;

    await reportMeteredUsage(subItemId, quantity);

    expect(
      mockStripeInstance.subscriptionItems.createUsageRecord
    ).toHaveBeenCalledWith(
      subItemId,
      expect.objectContaining({
        quantity,
        action: 'increment',
      })
    );
  });

  it('should call Stripe to report an overage charge', async () => {
    const customerId = 'cus_123';
    const amount = 1500; // $15.00
    const description = 'AWS Overage';

    await reportOverageCharge(customerId, amount, description);

    expect(mockStripeInstance.invoiceItems.create).toHaveBeenCalledWith({
      customer: customerId,
      amount,
      currency: 'usd',
      description,
    });
  });
});
