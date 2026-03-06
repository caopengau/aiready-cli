import { type ToolScoringOutput, ToolName } from '@aiready/core';
import type { AgentGroundingReport } from './types';

/**
 * Convert agent grounding report into a ToolScoringOutput
 * for inclusion in the unified AIReady score.
 */
export function calculateGroundingScore(
  report: AgentGroundingReport
): ToolScoringOutput {
  const { summary, rawData, recommendations } = report;

  const factors: ToolScoringOutput['factors'] = [
    {
      name: 'Structure Clarity',
      impact: Math.round(summary.dimensions.structureClarityScore - 50),
      description: `${rawData.deepDirectories} of ${rawData.totalDirectories} dirs exceed recommended depth`,
    },
    {
      name: 'Self-Documentation',
      impact: Math.round(summary.dimensions.selfDocumentationScore - 50),
      description: `${rawData.vagueFileNames} of ${rawData.totalFiles} files have vague names`,
    },
    {
      name: 'Entry Points',
      impact: Math.round(summary.dimensions.entryPointScore - 50),
      description: rawData.hasRootReadme
        ? rawData.readmeIsFresh
          ? 'README present and fresh'
          : 'README present but stale'
        : 'No root README',
    },
    {
      name: 'API Clarity',
      impact: Math.round(summary.dimensions.apiClarityScore - 50),
      description: `${rawData.untypedExports} of ${rawData.totalExports} exports lack type annotations`,
    },
    {
      name: 'Domain Consistency',
      impact: Math.round(summary.dimensions.domainConsistencyScore - 50),
      description: `${rawData.inconsistentDomainTerms} inconsistent domain terms detected`,
    },
  ];

  const recs: ToolScoringOutput['recommendations'] = recommendations.map(
    (action) => ({
      action,
      estimatedImpact: 6,
      priority: summary.score < 50 ? 'high' : 'medium',
    })
  );

  return {
    toolName: ToolName.AgentGrounding,
    score: summary.score,
    rawMetrics: {
      ...rawData,
      rating: summary.rating,
    },
    factors,
    recommendations: recs,
  };
}
