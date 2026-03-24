import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consistencyAction } from '../consistency';
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

vi.mock('@aiready/consistency', () => ({
  analyzeConsistency: vi.fn().mockResolvedValue({
    results: [
      {
        fileName: 'f1.ts',
        issues: [
          {
            category: 'naming',
            severity: 'major',
            message: 'Bad name',
            location: { file: 'f1.ts', line: 1 },
          },
        ],
      },
    ],
    summary: {
      filesAnalyzed: 1,
      totalIssues: 1,
      namingIssues: 1,
      patternIssues: 0,
    },
    recommendations: ['Fix names'],
  }),
  calculateConsistencyScore: vi.fn().mockReturnValue({
    score: 80,
    toolName: 'Consistency',
    rawMetrics: {},
    factors: [],
    recommendations: [],
  }),
}));

import {
  analyzeConsistency,
  calculateConsistencyScore,
} from '@aiready/consistency';

describe('Consistency CLI Action', () => {
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
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
    vi.mocked(calculateConsistencyScore).mockReturnValue({
      score: 80,
      toolName: 'Consistency',
      rawMetrics: {},
      factors: [],
      recommendations: [],
    });
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

  it('runs consistency analysis and outputs to console', async () => {
    await consistencyAction('.', {});
    expect(analyzeConsistency).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Summary'));
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Naming Issues')
    );
  });

  it('supports JSON output', async () => {
    vi.mocked(core.resolveOutputFormat).mockReturnValue({
      format: 'json',
      file: undefined,
    });
    await consistencyAction('.', {});
    expect(core.handleStandardJSONOutput).toHaveBeenCalled();
  });

  it('supports Markdown output', async () => {
    vi.mocked(core.resolveOutputFormat).mockReturnValue({
      format: 'markdown',
      file: undefined,
    });
    await consistencyAction('.', {});
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('calculates score if requested', async () => {
    withScore();
    await consistencyAction('.', { score: true });
    // Check all console.log calls for anything containing "Score"
    const allCalls = consoleSpy.mock.calls.map((args: any[]) => args.join(' '));
    const hasScoreOutput = allCalls.some((call: string) =>
      call.includes('Score')
    );
    expect(hasScoreOutput).toBe(true);
  });
});
