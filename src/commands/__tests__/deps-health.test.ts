import { describe, it, expect, vi } from 'vitest';
import { depsHealthAction } from '..';

vi.mock('@aiready/deps', () => ({
  analyzeDeps: vi.fn().mockResolvedValue({
    summary: { score: 90, rating: 'excellent' },
    rawData: {},
    recommendations: [],
    issues: [],
  }),
  calculateDepsScore: vi.fn().mockReturnValue({ score: 90 }),
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

describe('Deps Health CLI Action', () => {
  it('should run analysis and return scoring', async () => {
    const result = await depsHealthAction('.', { output: 'json', score: true });
    expect(result?.scoring?.score).toBe(90);
  });
});
