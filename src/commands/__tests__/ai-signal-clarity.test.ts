import { describe, it, expect, vi } from 'vitest';
import { aiSignalClarityAction } from '..';

vi.mock('@aiready/ai-signal-clarity', () => ({
  analyzeAiSignalClarity: vi.fn().mockResolvedValue({
    summary: {
      score: 85,
      rating: 'low',
      topRisk: 'none',
      totalSignals: 0,
      criticalSignals: 0,
      majorSignals: 0,
      minorSignals: 0,
    },
    results: [],
  }),
  calculateAiSignalClarityScore: vi.fn().mockReturnValue({ score: 85 }),
  generateSummary: (report: any) => report.summary || report,
}));

vi.mock('@aiready/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aiready/core')>();
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue({}),
    mergeConfigWithDefaults: vi
      .fn()
      .mockImplementation((c, d) => ({ ...d, ...c })),
    handleCLIError: vi.fn(),
  };
});

describe('AI Signal Clarity CLI Action', () => {
  it('should run analysis and return scoring', async () => {
    const result = await aiSignalClarityAction('.', {
      output: 'json',
      score: true,
    });
    expect(result?.scoring?.score).toBe(85);
  });
});
