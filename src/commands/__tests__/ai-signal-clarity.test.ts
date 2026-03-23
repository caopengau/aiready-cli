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
}));

vi.mock('@aiready/core', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
  mergeConfigWithDefaults: vi
    .fn()
    .mockImplementation((c, d) => ({ ...d, ...c })),
}));

describe('AI Signal Clarity CLI Action', () => {
  it('should run analysis and return scoring', async () => {
    const result = await aiSignalClarityAction('.', { output: 'json' });
    expect(result?.score).toBe(85);
  });
});
