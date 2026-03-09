import { describe, it, expect } from 'vitest';
import { calculateDocDriftScore } from '../scoring';
import { DocDriftReport } from '../types';
import { ToolName } from '@aiready/core';

describe('Doc Drift Scoring', () => {
  const mockReport: DocDriftReport = {
    summary: {
      filesAnalyzed: 10,
      functionsAnalyzed: 50,
      score: 70,
      rating: 'good',
    },
    issues: [],
    rawData: {
      uncommentedExports: 10,
      totalExports: 50,
      outdatedComments: 2,
      undocumentedComplexity: 1,
    },
    recommendations: ['Add JSDoc to exports'],
  };

  it('should map report to ToolScoringOutput correctly', () => {
    const scoring = calculateDocDriftScore(mockReport);

    expect(scoring.toolName).toBe(ToolName.DocDrift);
    expect(scoring.score).toBe(70);
    expect(scoring.factors.length).toBeGreaterThan(0);
    expect(scoring.recommendations[0].action).toBe('Add JSDoc to exports');
  });

  it('should set high priority for low scores', () => {
    const lowScoreReport: DocDriftReport = {
      ...mockReport,
      summary: {
        ...mockReport.summary,
        score: 40,
      },
    };

    const scoring = calculateDocDriftScore(lowScoreReport);
    expect(scoring.recommendations[0].priority).toBe('high');
  });
});
