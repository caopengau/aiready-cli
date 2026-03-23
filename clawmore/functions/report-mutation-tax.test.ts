import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => {
  // Use a class for GetCommand mock
  class MockGetCommand {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  }
  return {
    DynamoDBClient: vi.fn(),
    DynamoDBDocumentClient: {
      from: vi.fn(() => ({
        send: mockSend,
      })),
    },
    GetCommand: MockGetCommand,
  };
});

vi.mock('../lib/billing', () => ({
  reportMeteredUsage: vi.fn(),
}));

import { handler } from './report-mutation-tax';
import { reportMeteredUsage } from '../lib/billing';

describe('report-mutation-tax handler', () => {
  const mockReportMeteredUsage = vi.mocked(reportMeteredUsage);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should report metered usage to Stripe when a valid mutation event is received', async () => {
    const event = {
      detail: {
        userId: 'user_123',
        mutationId: 'mut_456',
      },
    };

    mockSend.mockResolvedValueOnce({
      Item: {
        stripeMutationSubscriptionItemId: 'si_789',
      },
    } as any);

    await handler(event);

    expect(mockSend).toHaveBeenCalled();
    const getCall = mockSend.mock.calls[0][0] as any;
    expect(getCall.input.Key).toEqual({ PK: 'USER#user_123', SK: 'METADATA' });

    expect(mockReportMeteredUsage).toHaveBeenCalledWith('si_789', 1);
  });

  it('should log a warning and return if subscription item ID is not found', async () => {
    const event = {
      detail: {
        userId: 'user_123',
        mutationId: 'mut_456',
      },
    };

    mockSend.mockResolvedValueOnce({ Item: null } as any);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await handler(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'No Stripe subscription item found for user user_123'
      )
    );
    expect(mockReportMeteredUsage).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should waive the mutation tax and not report usage if user has opted into co-evolution', async () => {
    const event = {
      detail: {
        userId: 'user_123',
        mutationId: 'mut_456',
      },
    };

    mockSend.mockResolvedValueOnce({
      Item: {
        stripeMutationSubscriptionItemId: 'si_789',
        coEvolutionOptIn: true,
      },
    } as any);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await handler(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'User user_123 has opted into co-evolution. Mutation tax waived for mutation mut_456.'
      )
    );
    expect(mockReportMeteredUsage).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
