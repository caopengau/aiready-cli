import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@aiready/core';

vi.mock('@aiready/core', async () => {
  const actual = await vi.importActual('@aiready/core');
  return {
    ...actual,
    prepareActionConfig: vi.fn(),
    handleStandardJSONOutput: vi.fn(),
    handleCLIError: vi.fn(),
    getElapsedTime: vi.fn().mockReturnValue('0.2'),
    resolveOutputFormat: vi
      .fn()
      .mockReturnValue({ format: 'console', file: undefined }),
    formatToolScore: vi.fn().mockReturnValue('Score: 80'),
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

const mockAnalyzeContract = vi.fn().mockResolvedValue({
  results: { rawData: { 'as-any': 1, 'deep-optional-chain': 0 }, results: [] },
  summary: {
    totalDefensivePatterns: 1,
    defensiveDensity: 0.1,
    sourceFiles: 2,
    dimensions: {
      typeEscapeHatchScore: 50,
      fallbackCascadeScore: 70,
      errorTransparencyScore: 90,
      boundaryValidationScore: 30,
    },
  },
  recommendations: ['rec1'],
});

const mockCalcScore = vi.fn().mockReturnValue({
  score: 75,
  dimensions: { dimA: 1 },
  recommendations: ['r1'],
});

vi.mock('@aiready/contract-enforcement', () => ({
  analyzeContractEnforcement: mockAnalyzeContract,
  calculateContractEnforcementScore: mockCalcScore,
  generateSummary: (report: any) => report.summary || report,
}));

describe('Contract Enforcement Action', () => {
  let consoleSpy: any;
  let action: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(core.prepareActionConfig).mockImplementation(
      async (dir: any, defaults: any, cliOpts: any) =>
        ({
          resolvedDir: '/test',
          finalOptions: { ...defaults, ...cliOpts },
        }) as any
    );
    const mod = await import('../contract-enforcement');
    action = mod.contractEnforcementAction;
  });

  it('runs contract enforcement and prints output', async () => {
    await action('.', {});
    expect(mockAnalyzeContract).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('supports JSON output', async () => {
    vi.mocked(core.resolveOutputFormat).mockReturnValue({
      format: 'json',
      file: undefined,
    });
    await action('.', {});
    expect(core.handleStandardJSONOutput).toHaveBeenCalled();
  });

  it('calculates score when requested', async () => {
    vi.mocked(core.prepareActionConfig).mockImplementation(
      async (dir: any, defaults: any, cliOpts: any) =>
        ({
          resolvedDir: '/test',
          finalOptions: { ...defaults, ...cliOpts, score: true },
        }) as any
    );
    await action('.', { score: true } as any);
    expect(mockCalcScore).toHaveBeenCalled();
  });
});
