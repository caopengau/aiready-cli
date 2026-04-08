import { describe, it, expect, vi } from 'vitest';
import { agentGroundingAction } from '../agent-grounding';

vi.mock('@aiready/agent-grounding', () => ({
  analyzeAgentGrounding: vi.fn().mockResolvedValue({
    summary: { score: 75, rating: 'good', dimensions: { apiClarityScore: 60 } },
    results: [],
  }),
  calculateGroundingScore: vi.fn().mockReturnValue({ score: 75 }),
  generateSummary: (report: any) => report.summary || report,
}));

vi.mock('@aiready/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aiready/core')>();
  return {
    ...original,
    loadConfig: vi.fn().mockResolvedValue({}),
    mergeConfigWithDefaults: vi
      .fn()
      .mockImplementation((c, d) => ({ ...d, ...c })),
    handleCLIError: vi.fn(),
    prepareActionConfig: vi.fn().mockResolvedValue({
      resolvedDir: '.',
      finalOptions: { output: { format: 'json', file: undefined } },
    }),
    resolveOutputFormat: vi
      .fn()
      .mockReturnValue({ format: 'json', file: undefined }),
    formatStandardReport: vi.fn().mockReturnValue({ score: 75 }),
    handleStandardJSONOutput: vi.fn(),
    getElapsedTime: vi.fn().mockReturnValue('0.00'),
  };
});

describe('Agent Grounding CLI Action', () => {
  it('should run analysis and return scoring', async () => {
    const result = await agentGroundingAction('.', {
      output: 'json',
      score: true,
    });
    expect(result?.score).toBe(75);
  });
});
