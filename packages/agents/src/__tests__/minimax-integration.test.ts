import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemediationSwarm } from '../workflows/remediation-swarm';
import { Agent } from '@mastra/core/agent';

// Mock MCPAdapter
vi.mock('../tools/mcp-adapter', () => {
  const MockAdapter = vi.fn();
  MockAdapter.prototype.connect = vi.fn().mockResolvedValue(undefined);
  MockAdapter.prototype.disconnect = vi.fn().mockResolvedValue(undefined);
  MockAdapter.prototype.getMastraTools = vi.fn().mockResolvedValue({
    'list-files': { id: 'list-files', execute: vi.fn() },
    'create-pr': { id: 'create-pr', execute: vi.fn() },
  });
  return { MCPAdapter: MockAdapter };
});

// Mock Mastra Agent
vi.mock('@mastra/core/agent', () => {
  const MockAgent = vi.fn();
  MockAgent.prototype.generate = vi.fn().mockResolvedValue({
    text: JSON.stringify({
      status: 'success',
      diff: 'test-diff',
      explanation: 'Fixed with MiniMax',
    }),
  });
  return { Agent: MockAgent };
});

describe('RemediationSwarm - MiniMax Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use the provided model from config', async () => {
    const input = {
      remediation: { id: 'rem-m27', type: 'refactor' },
      repo: { url: 'https://github.com/test/repo' },
      rootDir: '/tmp/test',
      config: {
        minimaxApiKey: 'test-key',
        model: 'anthropic/MiniMax-M2.7',
      },
    };

    await RemediationSwarm.execute(input);

    // Verify Agent was initialized with the correct model
    expect(Agent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'anthropic/MiniMax-M2.7',
      })
    );
  });

  it('should fallback to default model if none provided', async () => {
    const input = {
      remediation: { id: 'rem-default' },
      repo: { url: 'https://github.com/test/repo' },
      rootDir: '/tmp/test',
      config: {
        openaiApiKey: 'oa-key',
      },
    };

    await RemediationSwarm.execute(input);

    // Verify Agent was initialized with the default model
    expect(Agent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'anthropic/MiniMax-M2.7',
      })
    );
  });
});
