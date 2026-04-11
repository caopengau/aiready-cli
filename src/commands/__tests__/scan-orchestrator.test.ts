import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runUnifiedScan } from '../scan-orchestrator';
import * as index from '../../index';
import * as core from '@aiready/core';
import fs from 'fs';

vi.mock('../../index', () => ({
  analyzeUnified: vi.fn(),
  scoreUnified: vi.fn(),
}));

vi.mock('@aiready/core', async () => {
  const actual = await vi.importActual('@aiready/core');
  return {
    ...actual,
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

describe('Scan Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});

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
            issues: [],
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

  it('runs analysis and scoring', async () => {
    const finalOptions = {
      tools: ['pattern-detect'],
      scoring: { showBreakdown: true },
    };
    const { results, scoringResult } = await runUnifiedScan(
      '.',
      finalOptions,
      { score: true },
      Date.now()
    );

    expect(index.analyzeUnified).toHaveBeenCalled();
    expect(index.scoreUnified).toHaveBeenCalled();
    expect(results.summary.toolsRun).toContain('pattern-detect');
    expect(scoringResult?.overall).toBe(80);
  });

  it('calculates business metrics when context is available', async () => {
    const finalOptions = {
      tools: ['pattern-detect'],
      scoring: { showBreakdown: true },
    };
    const { results, scoringResult } = await runUnifiedScan(
      '.',
      finalOptions,
      { score: true },
      Date.now()
    );

    expect(core.calculateTokenBudget).toHaveBeenCalled();
    expect((scoringResult as any)?.tokenBudget).toBeDefined();
    expect((scoringResult as any)?.businessROI).toBeDefined();
    expect((results.summary as any).businessImpact).toBeDefined();
  });
});
