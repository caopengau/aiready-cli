import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProvisioningOrchestrator } from './provision-node';

// Mock AWS Vending
vi.mock('../aws/vending', () => ({
  findAvailableAccountInPool: vi.fn().mockResolvedValue(null),
  createManagedAccount: vi.fn().mockResolvedValue('req-123'),
  waitForAccountCreation: vi.fn().mockResolvedValue('acc-456'),
  bootstrapManagedAccount: vi
    .fn()
    .mockResolvedValue('arn:aws:iam::acc-456:role/ClawMore-Bootstrap-Role'),
  assumeSubAccountRole: vi.fn().mockResolvedValue({
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    sessionToken: 'test-token',
  }),
}));

// Mock AWS Governance
vi.mock('../aws/governance', () => ({
  createServerlessSCP: vi.fn().mockResolvedValue('scp-789'),
  attachSCPToAccount: vi.fn().mockResolvedValue({}),
}));

// Mock Libsodium
vi.mock('libsodium-wrappers', () => ({
  default: {
    ready: Promise.resolve(),
    from_base64: vi.fn().mockReturnValue(new Uint8Array()),
    from_string: vi.fn().mockReturnValue(new Uint8Array()),
    crypto_box_seal: vi.fn().mockReturnValue(new Uint8Array()),
    to_base64: vi.fn().mockReturnValue('encrypted-value'),
    base64_variants: { ORIGINAL: 1 },
  },
}));

describe('ProvisioningOrchestrator', () => {
  let orchestrator: ProvisioningOrchestrator;
  let mockOctokit: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOctokit = {
      users: {
        getAuthenticated: vi
          .fn()
          .mockResolvedValue({ data: { login: 'testuser' } }),
      },
      repos: {
        createUsingTemplate: vi.fn().mockResolvedValue({
          data: {
            owner: { login: 'testuser' },
            html_url: 'https://github.com/testuser/test-repo',
          },
        }),
      },
      actions: {
        getRepoPublicKey: vi.fn().mockResolvedValue({
          data: { key: 'dGVzdC1wdWJsaWMta2V5', key_id: 'key-123' },
        }),
        createOrUpdateRepoSecret: vi.fn().mockResolvedValue({}),
      },
    };

    orchestrator = new ProvisioningOrchestrator(
      'fake-token',
      mockOctokit as any
    );
  });

  it('should orchestrate the full provisioning loop successfully', async () => {
    const options = {
      userEmail: 'test@example.com',
      userName: 'Test User',
      repoName: 'test-repo',
      githubToken: 'fake-token',
      coEvolutionOptIn: true,
    };

    const result = await orchestrator.provisionNode(options);

    expect(result).toEqual(
      expect.objectContaining({
        accountId: 'acc-456',
        repoUrl: 'https://github.com/testuser/test-repo',
        roleArn: 'arn:aws:iam::acc-456:role/ClawMore-Bootstrap-Role',
      })
    );

    // Verify GitHub calls
    expect(mockOctokit.repos.createUsingTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-repo',
        template_owner: 'caopengau',
        template_repo: 'serverlessclaw',
      })
    );

    // Verify Secret Injection (4 secrets should be injected)
    expect(mockOctokit.actions.createOrUpdateRepoSecret).toHaveBeenCalledTimes(
      4
    );
  });
});
