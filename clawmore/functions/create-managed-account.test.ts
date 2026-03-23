import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handler } from './create-managed-account';
import * as vending from '../lib/aws/vending';
import * as governance from '../lib/aws/governance';

// Mock the libraries
vi.mock('../lib/aws/vending', () => ({
  createManagedAccount: vi.fn(),
  waitForAccountCreation: vi.fn(),
  bootstrapManagedAccount: vi.fn(),
}));

vi.mock('../lib/aws/governance', () => ({
  createServerlessSCP: vi.fn(),
  attachSCPToAccount: vi.fn(),
}));

describe('create-managed-account handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silence console for clean test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create, secure, and bootstrap a new managed account', async () => {
    const event = {
      body: JSON.stringify({
        userEmail: 'test@example.com',
        userName: 'TestUser',
      }),
    };

    // Mock successful vending flow
    vi.mocked(vending.createManagedAccount).mockResolvedValue('req_123');
    vi.mocked(vending.waitForAccountCreation).mockResolvedValue('123456789012');
    vi.mocked(governance.createServerlessSCP).mockResolvedValue('scp_999');
    vi.mocked(vending.bootstrapManagedAccount).mockResolvedValue(
      'arn:aws:iam::123456789012:role/ClawMore-Bootstrap-Role'
    );

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.accountId).toBe('123456789012');

    // Verify correct order and arguments
    expect(vending.createManagedAccount).toHaveBeenCalledWith(
      'test@example.com',
      'TestUser'
    );
    expect(vending.waitForAccountCreation).toHaveBeenCalledWith('req_123');
    expect(governance.attachSCPToAccount).toHaveBeenCalledWith(
      'scp_999',
      '123456789012'
    );
    expect(vending.bootstrapManagedAccount).toHaveBeenCalledWith(
      '123456789012'
    );
  });

  it('should return 400 if userEmail or userName is missing', async () => {
    const event = {
      body: JSON.stringify({
        userEmail: 'test@example.com',
        // missing userName
      }),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Missing userEmail or userName');
  });

  it('should return 500 if any step in the vending process fails', async () => {
    const event = {
      body: JSON.stringify({
        userEmail: 'test@example.com',
        userName: 'TestUser',
      }),
    };

    vi.mocked(vending.createManagedAccount).mockRejectedValue(
      new Error('AWS Organizations Error')
    );

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe(
      'Failed to create or secure managed account'
    );
  });
});
