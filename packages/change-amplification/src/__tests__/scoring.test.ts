import { describe, it, expect } from 'vitest';
import { calculateChangeAmplificationScore } from '../scoring';
import { ChangeAmplificationReport } from '../types';
import { ToolName } from '@aiready/core';

describe('Change Amplification Scoring', () => {
  const mockReport: ChangeAmplificationReport = {
    summary: {
      totalFiles: 100,
      totalIssues: 5,
      criticalIssues: 1,
      majorIssues: 4,
      score: 80,
      rating: 'stable',
      recommendations: ['Keep it up'],
    },
    results: [],
  };

  it('should map report to ToolScoringOutput correctly', () => {
    const scoring = calculateChangeAmplificationScore(mockReport);

    expect(scoring.toolName).toBe(ToolName.ChangeAmplification);
    expect(scoring.score).toBe(80);
    expect(scoring.factors[0].name).toBe('Graph Stability');
    expect(scoring.factors[0].impact).toBe(30); // 80 - 50
  });

  it('should detect instability for low scores', () => {
    const lowScoreReport: ChangeAmplificationReport = {
      ...mockReport,
      summary: {
        ...mockReport.summary,
        score: 20,
        rating: 'explosive',
      },
    };

    const scoring = calculateChangeAmplificationScore(lowScoreReport);
    expect(scoring.factors[0].description).toContain('High coupling');
    expect(scoring.recommendations[0].priority).toBe('high');
  });
});
