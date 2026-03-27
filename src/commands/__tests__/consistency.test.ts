import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@aiready/core';
import * as fs from 'fs';

vi.mock('@aiready/core', async () => {
  const actual = await vi.importActual('@aiready/core');
  return {
    ...actual,
    prepareActionConfig: vi.fn(),
    handleStandardJSONOutput: vi.fn(),
    handleCLIError: vi.fn(),
    getElapsedTime: vi.fn().mockReturnValue('1.0'),
    resolveOutputPath: vi.fn().mockReturnValue('report.json'),
    formatToolScore: vi.fn().mockReturnValue('Score: 80'),
    resolveOutputFormat: vi
      .fn()
      .mockImplementation((opts: any, finalOpts: any) => {
        // Return the actual format based on options
        if (opts?.output === 'json' || finalOpts?.output?.format === 'json') {
          return { format: 'json', file: undefined };
        }
        if (
          opts?.output === 'markdown' ||
          finalOpts?.output?.format === 'markdown'
        ) {
          return { format: 'markdown', file: undefined };
        }
        return { format: 'console', file: undefined };
      }),
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

// Mock the consistency module
const mockAnalyzeConsistency = vi.fn().mockResolvedValue({
  results: [
    {
      fileName: 'f1.ts',
      issues: [
        {
          type: 'naming-inconsistency',
          severity: 'major',
          message: 'Bad name',
          location: { file: 'f1.ts', line: 1 },
        },
      ],
      metrics: {},
    },
  ],
  summary: {
    filesAnalyzed: 1,
    totalIssues: 1,
    namingIssues: 1,
    patternIssues: 0,
    architectureIssues: 0,
  },
  recommendations: ['Fix names'],
});

const mockCalculateConsistencyScore = vi.fn().mockReturnValue({
  score: 80,
  toolName: 'Consistency',
  rawMetrics: {},
  factors: [],
  recommendations: [],
});

vi.mock('@aiready/consistency', () => ({
  analyzeConsistency: mockAnalyzeConsistency,
  calculateConsistencyScore: mockCalculateConsistencyScore,
}));

describe('Consistency CLI Action', () => {
  let consoleSpy: any;
  let consistencyAction: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(core.formatToolScore).mockReturnValue('Score: 80');
    vi.mocked(core.prepareActionConfig).mockImplementation(
      async (dir: any, defaults: any, cliOpts: any) => {
        return {
          resolvedDir: '/test',
          finalOptions: {
            ...defaults,
            ...cliOpts,
          },
        } as any;
      }
    );
    vi.mocked(core.resolveOutputFormat).mockReturnValue({
      format: 'console',
      file: undefined,
    });
    mockAnalyzeConsistency.mockResolvedValue({
      results: [
        {
          fileName: 'f1.ts',
          issues: [
            {
              type: 'naming-inconsistency',
              severity: 'major',
              message: 'Bad name',
              location: { file: 'f1.ts', line: 1 },
            },
          ],
          metrics: {},
        },
      ],
      summary: {
        filesAnalyzed: 1,
        totalIssues: 1,
        namingIssues: 1,
        patternIssues: 0,
        architectureIssues: 0,
      },
      recommendations: ['Fix names'],
    });
    mockCalculateConsistencyScore.mockReturnValue({
      score: 80,
      toolName: 'Consistency',
      rawMetrics: {},
      factors: [],
      recommendations: [],
    });
    // Import the module after mocks are set up
    const module = await import('../consistency');
    consistencyAction = module.consistencyAction;
  });

  // Helper to set score option for tests
  function withScore() {
    vi.mocked(core.prepareActionConfig).mockImplementation(
      async (dir: any, defaults: any, cliOpts: any) => {
        return {
          resolvedDir: '/test',
          finalOptions: {
            ...defaults,
            ...cliOpts,
            score: true,
          },
        } as any;
      }
    );
  }

  it.skip('runs consistency analysis and outputs to console', async () => {
    await consistencyAction('.', {});
    expect(mockAnalyzeConsistency).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Summary'));
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Naming Issues')
    );
  });

  it.skip('supports JSON output', async () => {
    vi.mocked(core.resolveOutputFormat).mockReturnValue({
      format: 'json',
      file: undefined,
    });
    await consistencyAction('.', {});
    expect(core.handleStandardJSONOutput).toHaveBeenCalled();
  });

  it.skip('supports Markdown output', async () => {
    vi.mocked(core.resolveOutputFormat).mockReturnValue({
      format: 'markdown',
      file: undefined,
    });
    await consistencyAction('.', {});
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it.skip('calculates score if requested', async () => {
    withScore();
    await consistencyAction('.', { score: true });
    // Verify that the score calculation was attempted
    expect(mockCalculateConsistencyScore).toHaveBeenCalled();
  });
});
