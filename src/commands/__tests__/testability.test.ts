import { describe, it, expect, vi } from 'vitest';
import { testabilityAction } from '../testability';

vi.mock('@aiready/testability', () => ({
  analyzeTestability: vi.fn().mockResolvedValue({
    summary: {
      score: 80,
      rating: 'good',
      aiChangeSafetyRating: 'safe',
      coverageRatio: 0.5,
    },
    rawData: { testFiles: 5, sourceFiles: 10 },
  }),
  calculateTestabilityScore: vi.fn().mockReturnValue({ score: 80 }),
}));

vi.mock('@aiready/core', () => ({
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
  formatStandardReport: vi.fn().mockReturnValue({ score: 80 }),
  handleStandardJSONOutput: vi.fn(),
  getElapsedTime: vi.fn().mockReturnValue('0.00'),
}));

describe('Testability CLI Action', () => {
  it('should run analysis and return scoring in json mode', async () => {
    const result = await testabilityAction('.', { output: 'json' });
    expect(result?.score).toBe(80);
  });

  it('should run analysis and print to console in default mode', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await testabilityAction('.', { output: 'console' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should warn when AI change safety rating is blind-risk', async () => {
    const testability = await import('@aiready/testability');
    vi.spyOn(testability, 'analyzeTestability' as any).mockResolvedValueOnce({
      summary: {
        score: 0,
        rating: 'poor',
        aiChangeSafetyRating: 'blind-risk',
        coverageRatio: 0,
      },
      rawData: { testFiles: 0, sourceFiles: 5 },
    });

    const core = await import('@aiready/core');
    vi.spyOn(core, 'resolveOutputFormat' as any).mockReturnValue({
      format: 'console',
      file: undefined,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await testabilityAction('.', { output: 'console' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('NO TESTS'));
    logSpy.mockRestore();
  });

  it('executes calculateScore mapping when recommendations exist', async () => {
    const testability = await import('@aiready/testability');
    vi.spyOn(
      testability,
      'calculateTestabilityScore' as any
    ).mockReturnValueOnce({
      score: 70,
      recommendations: ['rec1', 'rec2'],
    });

    const core = await import('@aiready/core');
    vi.spyOn(core, 'resolveOutputFormat' as any).mockReturnValue({
      format: 'console',
      file: undefined,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await testabilityAction('.', { output: 'console', score: true });
    expect(testability.calculateTestabilityScore).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
