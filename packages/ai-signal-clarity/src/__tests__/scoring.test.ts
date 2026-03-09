import { describe, it, expect } from 'vitest';
import { calculateAiSignalClarityScore } from '../scoring';
import { AiSignalClarityReport } from '../types';
import { ToolName } from '@aiready/core';

describe('AI Signal Clarity Scoring', () => {
  const mockReport: AiSignalClarityReport = {
    summary: {
      filesAnalyzed: 10,
      totalSignals: 5,
      criticalSignals: 1,
      majorSignals: 2,
      minorSignals: 2,
      topRisk: 'magic-literals',
      rating: 'moderate',
    },
    results: [],
    aggregateSignals: {
      magicLiterals: 5,
      booleanTraps: 2,
      ambiguousNames: 1,
      undocumentedExports: 3,
      implicitSideEffects: 0,
      deepCallbacks: 0,
      overloadedSymbols: 0,
      totalSymbols: 100,
      totalExports: 20,
    },
    recommendations: ['Reduce magic literals'],
  };

  it('should map report to ToolScoringOutput correctly', () => {
    const scoring = calculateAiSignalClarityScore(mockReport);

    expect(scoring.toolName).toBe(ToolName.AiSignalClarity);
    expect(scoring.score).toBeLessThanOrEqual(100);
    expect(scoring.score).toBeGreaterThanOrEqual(0);
    expect(scoring.factors.length).toBeGreaterThan(0);
    expect(scoring.recommendations[0].action).toBe('Reduce magic literals');
  });

  it('should handle zero signals with perfect score', () => {
    const perfectReport: AiSignalClarityReport = {
      ...mockReport,
      aggregateSignals: {
        magicLiterals: 0,
        booleanTraps: 0,
        ambiguousNames: 0,
        undocumentedExports: 0,
        implicitSideEffects: 0,
        deepCallbacks: 0,
        overloadedSymbols: 0,
        totalSymbols: 100,
        totalExports: 20,
      },
    };

    const scoring = calculateAiSignalClarityScore(perfectReport);
    expect(scoring.score).toBe(100);
  });
});
