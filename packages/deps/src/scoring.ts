import { calculateDependencyHealth, ToolName } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';
import type { DepsReport } from './types';

/**
 * Convert dependency health report into a ToolScoringOutput.
 */
export function calculateDepsScore(report: DepsReport): ToolScoringOutput {
  const { rawData, summary } = report;

  // Recalculate using core math to get risk contribution breakdown
  const riskResult = calculateDependencyHealth({
    totalPackages: rawData.totalPackages,
    outdatedPackages: rawData.outdatedPackages,
    deprecatedPackages: rawData.deprecatedPackages,
    trainingCutoffSkew: rawData.trainingCutoffSkew,
  });

  const factors: ToolScoringOutput['factors'] = riskResult.signals.map(
    (sig) => ({
      name: sig.name,
      impact: -sig.riskContribution,
      description: sig.description,
    })
  );

  const recommendations: ToolScoringOutput['recommendations'] =
    riskResult.recommendations.map((rec) => ({
      action: rec,
      estimatedImpact: 6,
      priority: summary.score < 50 ? 'high' : 'medium',
    }));

  return {
    toolName: ToolName.DependencyHealth,
    score: summary.score,
    rawMetrics: {
      ...rawData,
      rating: summary.rating,
    },
    factors,
    recommendations,
  };
}
