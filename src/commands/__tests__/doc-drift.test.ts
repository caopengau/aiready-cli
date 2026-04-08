import { describe, it, expect, vi } from 'vitest';
import { docDriftAction } from '..';

vi.mock('@aiready/doc-drift', () => ({
  analyzeDocDrift: vi.fn().mockResolvedValue({
    summary: { score: 20, rating: 'low' },
    rawData: {},
    recommendations: ['Update docs'],
    issues: [],
  }),
  calculateDocDriftScore: vi.fn().mockReturnValue({ score: 20 }),
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
  };
});

describe('Doc Drift CLI Action', () => {
  it('should run analysis and return scoring', async () => {
    const result = await docDriftAction('.', { output: 'json', score: true });
    expect(result?.scoring?.score).toBe(20);
  });
});
