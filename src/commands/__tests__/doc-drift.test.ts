import { describe, it, expect, vi } from 'vitest';
import { docDriftAction } from '..';

vi.mock('@aiready/doc-drift', () => ({
  analyzeDocDrift: vi.fn().mockResolvedValue({
    summary: { score: 20, rating: 'low' },
    rawData: {},
    recommendations: ['Update docs'],
    issues: [],
  }),
}));

vi.mock('@aiready/core', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
  mergeConfigWithDefaults: vi
    .fn()
    .mockImplementation((c, d) => ({ ...d, ...c })),
}));

describe('Doc Drift CLI Action', () => {
  it('should run analysis and return scoring', async () => {
    const result = await docDriftAction('.', { output: 'json' });
    expect(result?.toolName).toBe('doc-drift');
    expect(result?.score).toBe(20);
  });
});
