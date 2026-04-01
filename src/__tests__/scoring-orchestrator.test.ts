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
});
