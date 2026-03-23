import { describe, it, expect, vi } from 'vitest';
import { depsHealthAction } from '..';

vi.mock('@aiready/deps', () => ({
  analyzeDeps: vi.fn().mockResolvedValue({
    summary: { score: 90, rating: 'excellent' },
    rawData: {},
    recommendations: [],
    issues: [],
  }),
}));

vi.mock('@aiready/core', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
  mergeConfigWithDefaults: vi
    .fn()
    .mockImplementation((c, d) => ({ ...d, ...c })),
}));

describe('Deps Health CLI Action', () => {
  it('should run analysis and return scoring', async () => {
    const result = await depsHealthAction('.', { output: 'json' });
    expect(result?.toolName).toBe('dependency-health');
    expect(result?.score).toBe(90);
  });
});
