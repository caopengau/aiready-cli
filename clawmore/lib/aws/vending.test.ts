import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the AWS SDK client modules used by the implementation
vi.mock('@aws-sdk/client-organizations', () => {
  class OrganizationsClient {
    send: (...args: any[]) => Promise<any>;
    constructor() {
      this.send = mockSend;
    }
  }

  return {
    OrganizationsClient,
    CreateAccountCommand: class CreateAccountCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
    DescribeCreateAccountStatusCommand: class DescribeCreateAccountStatusCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
    ListAccountsCommand: class ListAccountsCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
    ListTagsForResourceCommand: class ListTagsForResourceCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
    TagResourceCommand: class TagResourceCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  };
});

vi.mock('@aws-sdk/client-sts', () => {
  class STSClient {
    send: (...args: any[]) => Promise<any>;
    constructor() {
      this.send = mockSend;
    }
  }

  return {
    STSClient,
    AssumeRoleCommand: class AssumeRoleCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
    GetCallerIdentityCommand: class GetCallerIdentityCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  };
});

vi.mock('@aws-sdk/client-iam', () => {
  class IAMClient {
    send: (...args: any[]) => Promise<any>;
    constructor() {
      this.send = mockSend;
    }
  }

  return {
    IAMClient,
    CreateRoleCommand: class CreateRoleCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
    AttachRolePolicyCommand: class AttachRolePolicyCommand {
      input: any;
      constructor(input: any) {
        this.input = input;
      }
    },
  };
});

// A shared sentinel for the mocked client's send behavior which tests will control
let mockSend: (...args: any[]) => Promise<any> = async () => ({});

describe('vending AWS helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    // reset mockSend to a safe default before each test
    mockSend = vi.fn(async (command: any) => {
      // Default: return empty success-like shapes
      return {};
    });
  });

  it('createManagedAccount returns request id when Organizations returns CreateAccountStatus.Id', async () => {
    mockSend = vi.fn(async (command: any) => {
      if (command.constructor.name === 'CreateAccountCommand') {
        return { CreateAccountStatus: { Id: 'req-abc-123' } };
      }
      return {};
    });

    const { createManagedAccount } = await import('./vending');
    const reqId = await createManagedAccount('user@example.com', 'TestCo');
    expect(reqId).toBe('req-abc-123');
  });

  it('waitForAccountCreation returns account id when status becomes SUCCEEDED', async () => {
    mockSend = vi.fn(async (command: any) => {
      if (command.constructor.name === 'DescribeCreateAccountStatusCommand') {
        return {
          CreateAccountStatus: {
            State: 'SUCCEEDED',
            AccountId: '111222333444',
          },
        };
      }
      return {};
    });

    const { waitForAccountCreation } = await import('./vending');
    const accountId = await waitForAccountCreation('req-abc', 1);
    expect(accountId).toBe('111222333444');
  });

  it('findAvailableAccountInPool returns an available account id when found', async () => {
    mockSend = vi.fn(async (command: any) => {
      if (command.constructor.name === 'ListAccountsCommand') {
        return { Accounts: [{ Id: 'acc-1', Status: 'ACTIVE' }] };
      }

      if (command.constructor.name === 'ListTagsForResourceCommand') {
        return { Tags: [{ Key: 'Status', Value: 'Available' }] };
      }

      return {};
    });

    const { findAvailableAccountInPool } = await import('./vending');
    const found = await findAvailableAccountInPool();
    expect(found).toBe('acc-1');
  });

  it('assignAccountToOwner sends TagResourceCommand with expected ResourceId', async () => {
    const sentCommands: any[] = [];
    mockSend = vi.fn(async (command: any) => {
      sentCommands.push(command);
      return {};
    });

    const { assignAccountToOwner } = await import('./vending');
    await assignAccountToOwner('acc-42', 'owner@example.com', 'repo-name');

    expect(sentCommands.length).toBeGreaterThan(0);
    const tagCmd = sentCommands.find(
      (c) => c.constructor.name === 'TagResourceCommand'
    );
    expect(tagCmd).toBeDefined();
    expect(tagCmd.input.ResourceId).toBe('acc-42');
  });
});
