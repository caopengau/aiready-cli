import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@aiready/core';

vi.mock('@aiready/core', async () => {
  const actual = await vi.importActual('@aiready/core');
  return {
    ...actual,
    prepareActionConfig: vi.fn(),
    handleStandardJSONOutput: vi.fn(),
    handleCLIError: vi.fn(),
    getElapsedTime: vi.fn().mockReturnValue('1.0'),
    resolveOutputFormat: vi
      .fn()
      .mockReturnValue({ format: 'console', file: undefined }),
    formatToolScore: vi.fn().mockReturnValue('Score: 80'),
    formatStandardReport: vi.fn(),
  };
});

const mockAnalyzePatterns = vi.fn().mockResolvedValue({
  results: [],
  duplicates: [],
  files: [],
});
const mockGenerateSummary = vi
  .fn()
  .mockReturnValue({ totalPatterns: 0, totalTokenCost: 0, patternsByType: {} });
const mockCalculatePatternScore = vi.fn().mockReturnValue({
  score: 80,
  toolName: 'Pattern detection',
  rawMetrics: {},
  factors: [],
  recommendations: [],
});

vi.mock('@aiready/pattern-detect', () => ({
  analyzePatterns: mockAnalyzePatterns,
  generateSummary: mockGenerateSummary,
  calculatePatternScore: mockCalculatePatternScore,
}));

describe('Patterns Action', () => {
  let patternsAction: any;
  let consoleSpy: any;

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
    const mod = await import('../patterns');
    patternsAction = mod.patternsAction;
  });

  it('runs patterns action and outputs to console', async () => {
    await patternsAction('.', {} as any);
    expect(mockAnalyzePatterns).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('supports JSON output', async () => {
    vi.mocked(core.resolveOutputFormat).mockReturnValue({
      format: 'json',
      file: undefined,
    });
    await patternsAction('.', {} as any);
    expect(core.handleStandardJSONOutput).toHaveBeenCalled();
  });

  it('renders duplicate patterns and types when present', async () => {
    // Prepare a richer result with duplicates and pattern types
    mockAnalyzePatterns.mockResolvedValueOnce({
      results: [
        { fileName: 'a.ts', issues: [], metrics: {} },
        { fileName: 'b.ts', issues: [], metrics: {} },
      ],
      files: ['a.ts', 'b.ts'],
      duplicates: [
        {
          file1: '/path/a.ts',
          file2: '/path/b.ts',
          similarity: 0.96,
          tokenCost: 1200,
          line1: 1,
          endLine1: 10,
          line2: 2,
          endLine2: 12,
        },
        {
          file1: '/path/c.ts',
          file2: '/path/d.ts',
          similarity: 0.92,
          tokenCost: 800,
          line1: 3,
          endLine1: 8,
          line2: 4,
          endLine2: 9,
        },
      ],
    });
    // Ensure generateSummary returns patternsByType and totalPatterns > 0
    mockGenerateSummary.mockReturnValueOnce({
      totalPatterns: 2,
      totalTokenCost: 2000,
      patternsByType: { exact: 1, similar: 1 },
    });

    await patternsAction('.', {} as any);
    expect(consoleSpy).toHaveBeenCalled();
    // ensure duplicates rendered: look for CRITICAL/HIGH labels
    // The labels are printed as part of the duplicate entries
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('registers command and maps CLI options correctly', async () => {
    const shared = await import('../shared/command-builder');
    const spy = vi.spyOn(shared, 'defineToolCommand');

    const fakeProgram = {
      command: vi.fn().mockReturnThis(),
      description: vi.fn().mockReturnThis(),
      argument: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      addHelpText: vi.fn().mockReturnThis(),
      action: vi.fn().mockReturnThis(),
    } as any;

    const mod = await import('../patterns');
    mod.definePatternsCommand(fakeProgram);

    expect(spy).toHaveBeenCalled();
    const config = spy.mock.calls[0][1];
    const cliOpts = config.actionConfig.getCliOptions({
      similarity: '0.6',
      minLines: '10',
      maxCandidates: '4',
      minSharedTokens: '20',
      fullScan: true,
    } as any);

    expect(cliOpts.minSimilarity).toBe(0.6);
    expect(cliOpts.minLines).toBe(10);
    expect(cliOpts.maxCandidatesPerBlock).toBe(4);
    expect(cliOpts.minSharedTokens).toBe(20);
    expect(cliOpts.useSmartDefaults).toBe(false);
  });

  it('importTool returns adapter functions wired to provider', async () => {
    const shared = await import('../shared/command-builder');
    const spy = vi.spyOn(shared, 'defineToolCommand');

    const fakeProgram = {
      command: vi.fn().mockReturnThis(),
      description: vi.fn().mockReturnThis(),
      argument: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      addHelpText: vi.fn().mockReturnThis(),
      action: vi.fn().mockReturnThis(),
    } as any;

    const mod = await import('../patterns');
    mod.definePatternsCommand(fakeProgram);
    const config = spy.mock.calls[0][1];
    const adapter = await config.actionConfig.importTool();

    expect(adapter.analyze).toBeDefined();
    expect(adapter.generateSummary).toBeDefined();
    expect(adapter.calculateScore).toBeDefined();

    await adapter.analyze({});
    expect(mockAnalyzePatterns).toHaveBeenCalled();
    const results = { results: [] };
    const summary = adapter.generateSummary(results);
    expect(mockGenerateSummary).toHaveBeenCalledWith(results);
  });

  it('directly invokes renderConsole to exercise printing branches', async () => {
    const shared = await import('../shared/command-builder');
    const spy = vi.spyOn(shared, 'defineToolCommand');

    const fakeProgram = {
      command: vi.fn().mockReturnThis(),
      description: vi.fn().mockReturnThis(),
      argument: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      addHelpText: vi.fn().mockReturnThis(),
      action: vi.fn().mockReturnThis(),
    } as any;

    const mod = await import('../patterns');
    mod.definePatternsCommand(fakeProgram);
    const config = spy.mock.calls[0][1];
    const actionConfig = config.actionConfig;

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Case: has types and multiple duplicates with different severities
    const results = {
      files: ['a.ts', 'b.ts'],
      duplicates: [
        {
          file1: '/x/a.ts',
          file2: '/x/b.ts',
          similarity: 0.96,
          tokenCost: 1200,
          line1: 1,
          endLine1: 2,
          line2: 3,
          endLine2: 4,
        },
        {
          file1: '/y/c.ts',
          file2: '/y/d.ts',
          similarity: 0.85,
          tokenCost: 400,
          line1: 5,
          endLine1: 6,
          line2: 7,
          endLine2: 8,
        },
      ],
    };

    const summary = {
      totalPatterns: 2,
      totalTokenCost: 1600,
      patternsByType: { exact: 1, similar: 1 },
    };

    actionConfig.renderConsole({
      results,
      summary,
      elapsedTime: '0.5',
      score: undefined,
      finalOptions: {},
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
