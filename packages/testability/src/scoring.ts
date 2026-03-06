import { type ToolScoringOutput, ToolName } from '@aiready/core';
import type { TestabilityReport } from './types';

/**
 * Convert testability report into a ToolScoringOutput for the unified score.
 */
export function calculateTestabilityScore(
  report: TestabilityReport
): ToolScoringOutput {
  const { summary, rawData, recommendations } = report;

  const factors: ToolScoringOutput['factors'] = [
    {
      name: 'Test Coverage',
      impact: Math.round(summary.dimensions.testCoverageRatio - 50),
      description: `${rawData.testFiles} test files / ${rawData.sourceFiles} source files (${Math.round(summary.coverageRatio * 100)}%)`,
    },
    {
      name: 'Function Purity',
      impact: Math.round(summary.dimensions.purityScore - 50),
      description: `${rawData.pureFunctions}/${rawData.totalFunctions} functions are pure`,
    },
    {
      name: 'Dependency Injection',
      impact: Math.round(summary.dimensions.dependencyInjectionScore - 50),
      description: `${rawData.injectionPatterns}/${rawData.totalClasses} classes use DI`,
    },
    {
      name: 'Interface Focus',
      impact: Math.round(summary.dimensions.interfaceFocusScore - 50),
      description: `${rawData.bloatedInterfaces} interfaces have >10 methods`,
    },
    {
      name: 'Observability',
      impact: Math.round(summary.dimensions.observabilityScore - 50),
      description: `${rawData.externalStateMutations} functions mutate external state`,
    },
  ];

  const recs: ToolScoringOutput['recommendations'] = recommendations.map(
    (action) => ({
      action,
      estimatedImpact: summary.aiChangeSafetyRating === 'blind-risk' ? 15 : 8,
      priority:
        summary.aiChangeSafetyRating === 'blind-risk' ||
        summary.aiChangeSafetyRating === 'high-risk'
          ? 'high'
          : 'medium',
    })
  );

  return {
    toolName: ToolName.TestabilityIndex,
    score: summary.score,
    rawMetrics: {
      ...rawData,
      rating: summary.rating,
      aiChangeSafetyRating: summary.aiChangeSafetyRating,
      coverageRatio: summary.coverageRatio,
    },
    factors,
    recommendations: recs,
  };
}
