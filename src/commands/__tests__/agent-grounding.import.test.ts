import { describe, it, expect, vi } from 'vitest';

vi.mock('@aiready/agent-grounding', () => ({
  analyzeAgentGrounding: vi.fn(async () => ({
    summary: { filesAnalyzed: 1, directoriesAnalyzed: 1, rating: 'ok' },
    results: [],
    metadata: {},
  })),
  calculateGroundingScore: (data: any) => ({
    score: 78,
    recommendations: ['add README'],
  }),
  generateSummary: (report: any) => report.summary || report,
}));

describe('Agent grounding import-based score mapping', () => {
  it('maps recommendations from tool.calculateGroundingScore', async () => {
    const { agentGroundingAction } = await import('../agent-grounding');

    // Call with score enabled so calculateScore is invoked
    const result = await agentGroundingAction('.', { score: true } as any);

    // executeToolAction returns a report object; ensure no exceptions and result exists
    expect(result).toBeDefined();
  });
});
