import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanAction } from '../scan';
import * as core from '@aiready/core';
import * as index from '../../index';
import * as upload from '../upload';
import { readFileSync } from 'fs';
import { Severity } from '@aiready/core';

vi.mock('../../index', () => ({
  analyzeUnified: vi.fn(),
  scoreUnified: vi.fn(),
}));

vi.mock('../upload', () => ({
  uploadAction: vi.fn(),
}));

vi.mock('@aiready/core', async () => {
  const actual = await vi.importActual('@aiready/core');
  return {
    ...actual,
    loadMergedConfig: vi.fn(),
    loadConfig: vi.fn(),
    getRepoMetadata: vi.fn().mockReturnValue({ name: 'test-repo' }),
    handleJSONOutput: vi.fn(),
    handleCLIError: vi.fn(),
    getElapsedTime: vi.fn().mockReturnValue('1.0'),
    resolveOutputPath: vi.fn().mockReturnValue('report.json'),
    formatScore: vi.fn().mockReturnValue('80/100'),
    calculateTokenBudget: vi.fn().mockReturnValue({
      efficiencyRatio: 0.8,
      wastedTokens: {
        total: 100,
        bySource: { duplication: 50, fragmentation: 50 },
      },
      totalContextTokens: 1000,
    }),
    calculateBusinessROI: vi.fn().mockReturnValue({
      monthlySavings: 500,
      productivityGainHours: 20,
      annualValue: 6000,
    }),
  };
});

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

describe('Scan CLI Action', () => {
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(core.loadMergedConfig).mockResolvedValue({
      tools: ['pattern-detect'],
      output: { format: 'console' },
      rootDir: '/test',
    });
    vi.mocked(index.analyzeUnified).mockResolvedValue({
      summary: {
        totalIssues: 5,
        toolsRun: ['pattern-detect'],
        totalFiles: 10,
        executionTime: 1000,
      },
      'pattern-detect': {
        results: [
          {
            fileName: 'f1.ts',
            issues: [
              { severity: Severity.Critical },
              { severity: Severity.Major },
            ],
          },
        ],
      },
    } as any);
    vi.mocked(index.scoreUnified).mockResolvedValue({
      overall: 80,
      breakdown: [
        {
          toolName: 'pattern-detect',
          score: 80,
          tokenBudget: {
            totalContextTokens: 1000,
            wastedTokens: { bySource: { duplication: 50, fragmentation: 50 } },
          },
        },
      ],
    } as any);
  });

  it('runs standard scan with scoring', async () => {
    await scanAction('.', { score: true });
    expect(index.analyzeUnified).toHaveBeenCalled();
    expect(index.scoreUnified).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('AI Readiness Overall Score')
    );
  });

  it('handles profiles correctly', async () => {
    await scanAction('.', { profile: 'agentic' });
    expect(core.loadMergedConfig).toHaveBeenCalled();
  });

  it('compares with previous report', async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ scoring: { overall: 70 } })
    );
    await scanAction('.', { compareTo: 'prev.json', score: true });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Trend: +10')
    );
  });

  it('handles CI failure on critical issues', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as any);

    await scanAction('.', { ci: true, failOn: 'critical', score: true });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('SCAN FAILED')
    );
    // Verify annotations are emitted
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Emitting GitHub Action annotations')
    );
    exitSpy.mockRestore();
  });

  it('handles upload flag', async () => {
    await scanAction('.', { upload: true, apiKey: 'test-key' });
    expect(upload.uploadAction).toHaveBeenCalled();
  });

  it('supports JSON output format', async () => {
    vi.mocked(core.loadMergedConfig).mockResolvedValue({
      tools: ['pattern-detect'],
      output: { format: 'json', file: 'out.json' },
      rootDir: '/test',
    });
    await scanAction('.', {});
    expect(core.handleJSONOutput).toHaveBeenCalled();
  });

  it('fails when score is below threshold from config', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as any);

    vi.mocked(core.loadMergedConfig).mockResolvedValue({
      tools: ['pattern-detect'],
      threshold: 90, // Higher than the mocked score of 80
      failOn: 'none', // Disable fail-on to test threshold specifically
      rootDir: '/test',
    });

    await scanAction('.', { score: true });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('SCAN FAILED: Score 80 < threshold 90')
    );
    exitSpy.mockRestore();
  });

  it('fails when failOn is set in config and issues are found', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as any);

    vi.mocked(core.loadMergedConfig).mockResolvedValue({
      tools: ['pattern-detect'],
      threshold: 0, // Low threshold to test failOn specifically
      failOn: 'critical',
      rootDir: '/test',
    });

    await scanAction('.', { score: true });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('SCAN FAILED: Found 1 critical issues')
    );
    exitSpy.mockRestore();
  });
});
