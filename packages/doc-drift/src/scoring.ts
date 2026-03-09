import { calculateDocDrift, ToolName } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';
import type { DocDriftReport } from './types';

/**
 * Convert doc-drift report into a ToolScoringOutput.
 */
export function calculateDocDriftScore(
  report: DocDriftReport
): ToolScoringOutput {
  const { rawData, summary } = report;

  // Recalculate using core math to get risk contribution breakdown
  const riskResult = calculateDocDrift({
    uncommentedExports: rawData.uncommentedExports,
    totalExports: rawData.totalExports,
    outdatedComments: rawData.outdatedComments,
    undocumentedComplexity: rawData.undocumentedComplexity,
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
      estimatedImpact: 8,
      priority: summary.score < 50 ? 'high' : 'medium',
    }));

  return {
    toolName: ToolName.DocDrift,
    score: summary.score,
    rawMetrics: {
      ...rawData,
      rating: summary.rating,
    },
    factors,
    recommendations,
  };
}
