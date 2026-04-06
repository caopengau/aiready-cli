import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoringOrchestrator } from '../scoring-orchestrator';
import { ToolName, ToolRegistry } from '@aiready/core';

// Mock the core scoring functions
vi.mock('@aiready/core', async () => {
  const actual = await vi.importActual('@aiready/core');
  return {
    ...actual,
    calculateOverallScore: vi.fn().mockImplementation((toolScores) => {
      let sum = 0;
      let count = 0;
      for (const score of toolScores.values()) {
        sum += score.score;
        count++;
      }
      return {
        overall: count > 0 ? Math.round(sum / count) : 0,
        breakdown: Array.from(toolScores.values()),
      };
    }),
  };
});

describe('ScoringOrchestrator', () => {
  let registry: ToolRegistry;
  let orchestrator: ScoringOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ToolRegistry('test-scoring');
    orchestrator = new ScoringOrchestrator(registry as any);
  });

  it('calculates scores when providers are in the registry', async () => {
    const mockProvider = {
      id: ToolName.PatternDetect,
      score: vi.fn().mockReturnValue({ toolName: 'pattern-detect', score: 85 }),
    };
    registry.register(mockProvider as any);

    const results = {
      summary: { toolsRun: [ToolName.PatternDetect] },
      [ToolName.PatternDetect]: { some: 'data' },
    } as any;

    const result = await orchestrator.score(results, {} as any);

    expect(result.overall).toBe(85);
    expect(result.breakdown[0].score).toBe(85);
  });

  it('handles alias matching with find()', async () => {
    const mockProvider = {
      id: ToolName.PatternDetect,
      alias: ['patterns'],
      score: vi.fn().mockReturnValue({ toolName: 'pattern-detect', score: 90 }),
    };
    registry.register(mockProvider as any);

    const results = {
      summary: { toolsRun: ['patterns'] },
      ['patterns']: { some: 'data' },
    } as any;

    const result = await orchestrator.score(results, {} as any);

    expect(result.overall).toBe(90);
  });

  it('returns empty scoring result if no tools found (legacy behavior)', async () => {
    const results = {
      summary: { toolsRun: ['non-existent'] },
    } as any;

    const result = await orchestrator.score(results, {} as any);

    expect(result.overall).toBe(0);
    expect(result.rating).toBe('Critical');
    expect(result.breakdown).toHaveLength(0);
  });

  it('calculates tokenBudget for pattern-detect duplicates', async () => {
    const mockProvider = {
      id: ToolName.PatternDetect,
      score: vi.fn().mockReturnValue({ toolName: 'pattern-detect', score: 75 }),
    };
    registry.register(mockProvider as any);

    const results = {
      summary: { toolsRun: [ToolName.PatternDetect], totalFiles: 2 },
      [ToolName.PatternDetect]: {
        duplicates: [{ tokenCost: 10 }, { tokenCost: 20 }],
        results: [],
      },
    } as any;

    const result = await orchestrator.score(results, {} as any);
    expect(result.breakdown[0].tokenBudget).toBeDefined();
  });

  it('calculates tokenBudget for context-analyzer from summary', async () => {
    const mockProvider = {
      id: ToolName.ContextAnalyzer,
      score: vi
        .fn()
        .mockReturnValue({ toolName: 'context-analyzer', score: 70 }),
    };
    registry.register(mockProvider as any);

    const results = {
      summary: { toolsRun: [ToolName.ContextAnalyzer], totalFiles: 1 },
      [ToolName.ContextAnalyzer]: {
        summary: { totalTokens: 500, totalPotentialSavings: 50 },
        results: [],
      },
    } as any;

    const result = await orchestrator.score(results, {} as any);
    expect(result.breakdown[0].tokenBudget).toBeDefined();
  });

  it('logs error when provider.score throws', async () => {
    const mockProvider = {
      id: ToolName.PatternDetect,
      score: vi.fn().mockImplementation(() => {
        throw new Error('score fail');
      }),
    };
    registry.register(mockProvider as any);

    const results = {
      summary: { toolsRun: [ToolName.PatternDetect] },
      [ToolName.PatternDetect]: { results: [] },
    } as any;

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await orchestrator.score(results, {} as any);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
