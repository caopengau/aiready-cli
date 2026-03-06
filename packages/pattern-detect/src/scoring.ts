import {
  calculateMonthlyCost,
  calculateProductivityImpact,
  DEFAULT_COST_CONFIG,
  type CostConfig,
  ToolName,
} from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';
import type { DuplicatePattern } from './detector';

/**
 * Calculate AI Readiness Score for pattern duplication (0-100)
 *
 * Based on:
 * - Number of duplicates per file
 * - Token waste per file
 * - High-impact duplicates (>1000 tokens or >70% similarity)
 *
 * Includes business value metrics:
 * - Estimated monthly cost of token waste
 * - Estimated developer hours to fix
 */
export function calculatePatternScore(
  duplicates: DuplicatePattern[],
  totalFilesAnalyzed: number,
  costConfig?: Partial<CostConfig>
): ToolScoringOutput {
  // Calculate raw metrics
  const totalDuplicates = duplicates.length;
  const totalTokenCost = duplicates.reduce((sum, d) => sum + d.tokenCost, 0);
  const highImpactDuplicates = duplicates.filter(
    (d) => d.tokenCost > 1000 || d.similarity > 0.7
  ).length;

  // Avoid division by zero
  if (totalFilesAnalyzed === 0) {
    return {
      toolName: ToolName.PatternDetect,
      score: 100,
      rawMetrics: {
        totalDuplicates: 0,
        totalTokenCost: 0,
        highImpactDuplicates: 0,
        totalFilesAnalyzed: 0,
      },
      factors: [],
      recommendations: [],
    };
  }

  // Normalize to duplicates per 100 files
  const duplicatesPerFile = (totalDuplicates / totalFilesAnalyzed) * 100;

  // Token waste per file
  const tokenWastePerFile = totalTokenCost / totalFilesAnalyzed;

  // Calculate penalties
  // Duplicates penalty: 0-60 points
  // - 0 duplicates = 0 penalty
  // - 1 duplicate per 10 files (10 per 100) = 6 penalty
  // - 1 duplicate per 5 files (20 per 100) = 12 penalty
  // - 1 duplicate per file (100 per 100) = 60 penalty
  const duplicatesPenalty = Math.min(60, duplicatesPerFile * 0.6);

  // Token waste penalty: 0-40 points
  // - 0 waste = 0 penalty
  // - 1000 tokens/file = 8 penalty
  // - 5000 tokens/file = 40 penalty
  const tokenPenalty = Math.min(40, tokenWastePerFile / 125);

  // High impact adjustment: -15 to +5 points
  // - No high-impact duplicates = +5 bonus
  // - 5+ high-impact duplicates = -10 penalty
  const highImpactPenalty =
    highImpactDuplicates > 0 ? Math.min(15, highImpactDuplicates * 2 - 5) : -5; // bonus

  const score = 100 - duplicatesPenalty - tokenPenalty - highImpactPenalty;
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  // Build factors array
  const factors = [
    {
      name: 'Duplication Density',
      impact: -Math.round(duplicatesPenalty),
      description: `${duplicatesPerFile.toFixed(1)} duplicates per 100 files`,
    },
    {
      name: 'Token Waste',
      impact: -Math.round(tokenPenalty),
      description: `${Math.round(tokenWastePerFile)} tokens wasted per file`,
    },
  ];

  if (highImpactDuplicates > 0) {
    factors.push({
      name: 'High-Impact Patterns',
      impact: -Math.round(highImpactPenalty),
      description: `${highImpactDuplicates} high-impact duplicates (>1000 tokens or >70% similar)`,
    });
  } else {
    factors.push({
      name: 'No High-Impact Patterns',
      impact: 5,
      description: 'No severe duplicates detected',
    });
  }

  // Generate recommendations
  const recommendations: ToolScoringOutput['recommendations'] = [];

  if (highImpactDuplicates > 0) {
    const estimatedImpact = Math.min(15, highImpactDuplicates * 3);
    recommendations.push({
      action: `Deduplicate ${highImpactDuplicates} high-impact pattern${highImpactDuplicates > 1 ? 's' : ''}`,
      estimatedImpact,
      priority: 'high',
    });
  }

  if (totalDuplicates > 10 && duplicatesPerFile > 20) {
    const estimatedImpact = Math.min(10, Math.round(duplicatesPenalty * 0.3));
    recommendations.push({
      action: 'Extract common patterns into shared utilities',
      estimatedImpact,
      priority: 'medium',
    });
  }

  if (tokenWastePerFile > 2000) {
    const estimatedImpact = Math.min(8, Math.round(tokenPenalty * 0.4));
    recommendations.push({
      action: 'Consolidate duplicated logic to reduce AI context waste',
      estimatedImpact,
      priority: totalTokenCost > 10000 ? 'high' : 'medium',
    });
  }

  // Calculate business value metrics
  const cfg = { ...DEFAULT_COST_CONFIG, ...costConfig };
  const estimatedMonthlyCost = calculateMonthlyCost(totalTokenCost, cfg);

  // Convert duplicates to issue format for productivity calculation
  const issues = duplicates.map((d) => ({
    severity:
      d.severity === 'critical'
        ? 'critical'
        : d.severity === 'major'
          ? 'major'
          : ('minor' as const),
  }));
  const productivityImpact = calculateProductivityImpact(issues);

  return {
    toolName: 'pattern-detect',
    score: finalScore,
    rawMetrics: {
      totalDuplicates,
      totalTokenCost,
      highImpactDuplicates,
      totalFilesAnalyzed,
      duplicatesPerFile: Math.round(duplicatesPerFile * 10) / 10,
      tokenWastePerFile: Math.round(tokenWastePerFile),
      // Business value metrics
      estimatedMonthlyCost,
      estimatedDeveloperHours: productivityImpact.totalHours,
    },
    factors,
    recommendations,
  };
}
