import { describe, it, expect } from 'vitest';
import { calculateTestabilityScore } from '../scoring';
import { TestabilityReport } from '../types';
import { ToolName } from '@aiready/core';

describe('Testability Scoring', () => {
  const mockReport: TestabilityReport = {
    summary: {
      sourceFiles: 10,
      testFiles: 5,
      coverageRatio: 0.5,
      score: 75,
      rating: 'good',
      aiChangeSafetyRating: 'safe',
      dimensions: {
        testCoverageRatio: 80,
        purityScore: 70,
        dependencyInjectionScore: 60,
        interfaceFocusScore: 90,
        observabilityScore: 80,
      },
    },
    issues: [],
    rawData: {
      sourceFiles: 10,
      testFiles: 5,
      pureFunctions: 7,
      totalFunctions: 10,
      injectionPatterns: 3,
      totalClasses: 5,
      bloatedInterfaces: 0,
      totalInterfaces: 2,
      externalStateMutations: 2,
      hasTestFramework: true,
    },
    recommendations: ['Add more tests'],
  };

  it('should map report to ToolScoringOutput correctly', () => {
    const scoring = calculateTestabilityScore(mockReport);

    expect(scoring.toolName).toBe(ToolName.TestabilityIndex);
    expect(scoring.score).toBe(75);
    expect(scoring.factors.length).toBe(5);

    const coverageFactor = scoring.factors.find(
      (f) => f.name === 'Test Coverage'
    );
    expect(coverageFactor?.impact).toBe(30); // 80 - 50
    expect(coverageFactor?.description).toContain(
      '5 test files / 10 source files'
    );
  });

  it('should set high priority for high-risk recommendations', () => {
    const highRiskReport: TestabilityReport = {
      ...mockReport,
      summary: {
        ...mockReport.summary,
        aiChangeSafetyRating: 'high-risk',
      },
    };

    const scoring = calculateTestabilityScore(highRiskReport);
    expect(scoring.recommendations[0].priority).toBe('high');
  });

  it('should set blind-risk impact correctly', () => {
    const blindRiskReport: TestabilityReport = {
      ...mockReport,
      summary: {
        ...mockReport.summary,
        aiChangeSafetyRating: 'blind-risk',
      },
    };

    const scoring = calculateTestabilityScore(blindRiskReport);
    expect(scoring.recommendations[0].estimatedImpact).toBe(15);
    expect(scoring.recommendations[0].priority).toBe('high');
  });
});
