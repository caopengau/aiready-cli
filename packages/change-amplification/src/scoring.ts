import { ToolName } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';
import type { ChangeAmplificationReport } from './types';

/**
 * Convert change amplification report into a ToolScoringOutput.
 */
export function calculateChangeAmplificationScore(
  report: ChangeAmplificationReport
): ToolScoringOutput {
  const { summary } = report;

  const factors: ToolScoringOutput['factors'] = [
    {
      name: 'Graph Stability',
      impact: Math.round(summary.score - 50),
      description:
        summary.score < 30
          ? 'High coupling detected in core modules'
          : 'Stable dependency structure',
    },
  ];

  const recommendations: ToolScoringOutput['recommendations'] =
    summary.recommendations.map((rec) => ({
      action: rec,
      estimatedImpact: 10,
      priority: summary.score < 50 ? 'high' : 'medium',
    }));

  return {
    toolName: ToolName.ChangeAmplification,
    score: summary.score,
    rawMetrics: {
      totalFiles: summary.totalFiles,
      totalIssues: summary.totalIssues,
      rating: summary.rating,
    },
    factors,
    recommendations,
  };
}
