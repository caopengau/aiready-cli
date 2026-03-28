/**
 * AI Ready Scoring Engine.
 * Responsible for calculating, normalizing, and formatting AI-readiness scores.
 *
 * @lastUpdated 2026-03-18
 */
import { ToolName } from './types';
import {
  ReadinessRating,
  getRating,
  getRatingSlug,
} from './utils/rating-helpers';

// Re-export for client bundle
export { getRatingSlug, getRating };

import {
  RecommendationPriority,
  type ToolScoringOutput,
  type ScoringResult,
  type ScoringConfig,
} from './scoring-types';

export { RecommendationPriority };
export type { ToolScoringOutput, ScoringResult, ScoringConfig };

/**
 * Constants for the scoring engine to eliminate magic literals.
 */
const SCORING_CONSTANTS = {
  WEIGHTS: {
    DEFAULT: 5,
    MAX: 100,
  },
  THRESHOLDS: {
    XS: 80,
    SMALL: 75,
    MEDIUM: 70,
    LARGE: 65,
    ENTERPRISE: 58,
    NORMALIZATION_OFFSET: 70,
  },
  FILE_COUNTS: {
    XS: 50,
    SMALL: 200,
    MEDIUM: 500,
    LARGE: 2000,
  },
  DELIMITERS: {
    LIST: ',',
    PAIR: ':',
    FORMULA_JOIN: ' + ',
  },
};

/**
 * Default weights for known tools.
 */
export const DEFAULT_TOOL_WEIGHTS: Record<string, number> = {
  [ToolName.PatternDetect]: 22,
  [ToolName.ContextAnalyzer]: 19,
  [ToolName.NamingConsistency]: 14,
  [ToolName.AiSignalClarity]: 11,
  [ToolName.AgentGrounding]: 10,
  [ToolName.TestabilityIndex]: 10,
  [ToolName.DocDrift]: 8,
  [ToolName.DependencyHealth]: 6,
  [ToolName.ChangeAmplification]: 8,
  [ToolName.ContractEnforcement]: 10,
};

/**
 * Tool name normalization map.
 * Maps common shorthands and aliases to canonical tool IDs.
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  patterns: ToolName.PatternDetect,
  'pattern-detect': ToolName.PatternDetect,
  context: ToolName.ContextAnalyzer,
  'context-analyzer': ToolName.ContextAnalyzer,
  consistency: ToolName.NamingConsistency,
  'naming-consistency': ToolName.NamingConsistency,
  'ai-signal': ToolName.AiSignalClarity,
  'ai-signal-clarity': ToolName.AiSignalClarity,
  grounding: ToolName.AgentGrounding,
  'agent-grounding': ToolName.AgentGrounding,
  testability: ToolName.TestabilityIndex,
  'testability-index': ToolName.TestabilityIndex,
  'doc-drift': ToolName.DocDrift,
  'deps-health': ToolName.DependencyHealth,
  'dependency-health': ToolName.DependencyHealth,
  'change-amp': ToolName.ChangeAmplification,
  'change-amplification': ToolName.ChangeAmplification,
  contract: ToolName.ContractEnforcement,
  'contract-enforcement': ToolName.ContractEnforcement,
};

/**
 * Model context tiers for context-aware threshold calibration.
 */
export type ModelContextTier =
  | 'compact' // 4k-16k  tokens
  | 'standard' // 16k-64k tokens
  | 'extended' // 64k-200k
  | 'frontier'; // 200k+

/**
 * Scoring profiles for project-aware weighting adjustments.
 *
 * Different profiles prioritize different aspects of AI readiness based
 * on the project's primary focus.
 */
export enum ScoringProfile {
  Default = 'default',
  Agentic = 'agentic', // Focus on AI agent navigation and signal
  Logic = 'logic', // Focus on testability and complexity
  UI = 'ui', // Focus on consistency and context
  Cost = 'cost', // Focus on token waste reduction
  Security = 'security', // Focus on consistency and dependency health
}

/**
 * Project-type-aware tool weight presets for different profiles.
 */
export const SCORING_PROFILES: Record<
  ScoringProfile,
  Record<string, number>
> = {
  [ScoringProfile.Default]: DEFAULT_TOOL_WEIGHTS,
  [ScoringProfile.Agentic]: {
    [ToolName.AiSignalClarity]: 25,
    [ToolName.AgentGrounding]: 25,
    [ToolName.TestabilityIndex]: 15,
    [ToolName.ContractEnforcement]: 15,
    [ToolName.ContextAnalyzer]: 10,
    [ToolName.NamingConsistency]: 10,
  },
  [ScoringProfile.Logic]: {
    [ToolName.TestabilityIndex]: 40,
    [ToolName.NamingConsistency]: 20,
    [ToolName.ContextAnalyzer]: 20,
    [ToolName.PatternDetect]: 10,
    [ToolName.ChangeAmplification]: 10,
  },
  [ScoringProfile.UI]: {
    [ToolName.NamingConsistency]: 30,
    [ToolName.ContextAnalyzer]: 30,
    [ToolName.PatternDetect]: 20,
    [ToolName.DocDrift]: 10,
    [ToolName.AiSignalClarity]: 10,
  },
  [ScoringProfile.Cost]: {
    [ToolName.PatternDetect]: 50,
    [ToolName.ContextAnalyzer]: 30,
    [ToolName.ChangeAmplification]: 10,
    [ToolName.DependencyHealth]: 10,
  },
  [ScoringProfile.Security]: {
    [ToolName.NamingConsistency]: 30,
    [ToolName.TestabilityIndex]: 25,
    [ToolName.ContractEnforcement]: 15,
    [ToolName.DependencyHealth]: 20,
    [ToolName.ContextAnalyzer]: 10,
  },
};

/**
 * Context budget thresholds per tier.
 *
 * "Ideal" represents target state. "Critical" represents failure state.
 */
export const CONTEXT_TIER_THRESHOLDS: Record<
  ModelContextTier,
  {
    idealTokens: number;
    criticalTokens: number;
    idealDepth: number;
  }
> = {
  compact: { idealTokens: 3_000, criticalTokens: 10_000, idealDepth: 4 },
  standard: { idealTokens: 5_000, criticalTokens: 15_000, idealDepth: 5 },
  extended: { idealTokens: 15_000, criticalTokens: 50_000, idealDepth: 7 },
  frontier: { idealTokens: 50_000, criticalTokens: 150_000, idealDepth: 10 },
};

/**
 * Project-size-adjusted minimum thresholds.
 *
 * Larger projects have slightly lower thresholds due to inherent complexity.
 */
export const SIZE_ADJUSTED_THRESHOLDS: Record<string, number> = {
  xs: SCORING_CONSTANTS.THRESHOLDS.XS, // < 50 files
  small: SCORING_CONSTANTS.THRESHOLDS.SMALL, // 50-200 files
  medium: SCORING_CONSTANTS.THRESHOLDS.MEDIUM, // 200-500 files
  large: SCORING_CONSTANTS.THRESHOLDS.LARGE, // 500-2000 files
  enterprise: SCORING_CONSTANTS.THRESHOLDS.ENTERPRISE, // 2000+ files
};

/**
 * Determine project size tier based on the total number of files.
 *
 * @param fileCount Total number of files in the project
 * @returns A string identifier for the project size tier (xs, small, medium, large, enterprise)
 */
export function getProjectSizeTier(
  fileCount: number
): keyof typeof SIZE_ADJUSTED_THRESHOLDS {
  if (fileCount < SCORING_CONSTANTS.FILE_COUNTS.XS) return 'xs';
  if (fileCount < SCORING_CONSTANTS.FILE_COUNTS.SMALL) return 'small';
  if (fileCount < SCORING_CONSTANTS.FILE_COUNTS.MEDIUM) return 'medium';
  if (fileCount < SCORING_CONSTANTS.FILE_COUNTS.LARGE) return 'large';
  return 'enterprise';
}

/**
 * Calculate the recommended minimum AI readiness threshold for a project.
 *
 * Threshold is adjusted based on project size and the model context tier targeted.
 *
 * @param fileCount Total number of files in the project
 * @param modelTier The model context tier targeted (compact, standard, extended, frontier)
 * @returns The recommended score threshold (0-100)
 */
export function getRecommendedThreshold(
  fileCount: number,
  modelTier: ModelContextTier = 'standard'
): number {
  const sizeTier = getProjectSizeTier(fileCount);
  const base = SIZE_ADJUSTED_THRESHOLDS[sizeTier];
  const modelBonus =
    modelTier === 'frontier' ? -3 : modelTier === 'extended' ? -2 : 0;
  return base + modelBonus;
}

/**
 * Normalize a tool name from a shorthand or alias to its canonical ID.
 *
 * @param shortName The tool shorthand or alias name
 * @returns The canonical tool ID
 */
export function normalizeToolName(shortName: string): string {
  return TOOL_NAME_MAP[shortName.toLowerCase()] ?? shortName;
}

/**
 * Retrieve the weight for a specific tool, considering overrides and profiles.
 *
 * @param toolName The canonical tool ID
 * @param toolConfig Optional configuration for the tool containing a weight
 * @param cliOverride Optional weight override from the CLI
 * @param profile Optional scoring profile to use
 * @returns The weight to be used for this tool in overall scoring
 */
export function getToolWeight(
  toolName: string,
  toolConfig?: { scoreWeight?: number },
  cliOverride?: number,
  profile: ScoringProfile = ScoringProfile.Default
): number {
  if (cliOverride !== undefined) return cliOverride;
  if (toolConfig?.scoreWeight !== undefined) return toolConfig.scoreWeight;

  const profileWeights = SCORING_PROFILES[profile] ?? DEFAULT_TOOL_WEIGHTS;
  return (
    profileWeights[toolName] ??
    DEFAULT_TOOL_WEIGHTS[toolName] ??
    SCORING_CONSTANTS.WEIGHTS.DEFAULT
  );
}

/**
 * Parse a comma-separated weight string from the CLI.
 *
 * Format: "tool1:weight1,tool2:weight2"
 *
 * @param weightStr The raw weight string from the CLI or config
 * @returns A Map of tool IDs to their parsed weights
 */
export function parseWeightString(weightStr?: string): Map<string, number> {
  const weights = new Map<string, number>();
  if (!weightStr) return weights;

  const pairs = weightStr.split(SCORING_CONSTANTS.DELIMITERS.LIST);
  for (const pair of pairs) {
    const [toolShortName, weightValueStr] = pair.split(
      SCORING_CONSTANTS.DELIMITERS.PAIR
    );
    if (toolShortName && weightValueStr) {
      const toolName = normalizeToolName(toolShortName.trim());
      const weight = parseInt(weightValueStr.trim(), 10);
      if (!isNaN(weight) && weight > 0) {
        weights.set(toolName, weight);
      }
    }
  }
  return weights;
}

/**
 * Calculate the overall consolidated AI Readiness Score.
 *
 * Orchestrates the weighted aggregation of all tool individual scores.
 *
 * @param toolOutputs Map of tool IDs to their individual scoring outputs
 * @param config Optional global configuration
 * @param cliWeights Optional weight overrides from the CLI
 * @returns Consolidate ScoringResult including overall score and rating
 */
export function calculateOverallScore(
  toolOutputs: Map<string, ToolScoringOutput>,
  config?: ScoringConfig,
  cliWeights?: Map<string, number>
): ScoringResult {
  if (toolOutputs.size === 0) {
    throw new Error('No tool outputs provided for scoring');
  }

  // Determine profile from config or use default
  const profile = (config?.profile as ScoringProfile) || ScoringProfile.Default;

  const weights = new Map<string, number>();
  for (const [toolName] of toolOutputs.entries()) {
    const cliWeight = cliWeights?.get(toolName);
    const configWeight = config?.tools?.[toolName]?.scoreWeight;
    const weight =
      cliWeight ??
      configWeight ??
      getToolWeight(toolName, undefined, undefined, profile);
    weights.set(toolName, weight);
  }

  let weightedSum = 0;
  let totalWeight = 0;

  const breakdown: ToolScoringOutput[] = [];
  const toolsUsed: string[] = [];
  const calculationWeights: Record<string, number> = {};

  for (const [toolName, output] of toolOutputs.entries()) {
    const weight = weights.get(toolName) ?? SCORING_CONSTANTS.WEIGHTS.DEFAULT;
    weightedSum += output.score * weight;
    totalWeight += weight;
    toolsUsed.push(toolName);
    calculationWeights[toolName] = weight;
    breakdown.push(output);
  }

  const overall = Math.round(weightedSum / totalWeight);
  const rating = getRating(overall);

  const formulaParts = Array.from(toolOutputs.entries()).map(
    ([name, output]) => {
      const weight = weights.get(name) ?? SCORING_CONSTANTS.WEIGHTS.DEFAULT;
      return `(${output.score} × ${weight})`;
    }
  );
  const formulaStr = `[${formulaParts.join(SCORING_CONSTANTS.DELIMITERS.FORMULA_JOIN)}] / ${totalWeight} = ${overall}`;

  return {
    overall,
    rating,
    timestamp: new Date().toISOString(),
    toolsUsed,
    breakdown,
    calculation: {
      formula: formulaStr,
      weights: calculationWeights,
      normalized: formulaStr,
    },
  };
}

/**
 * Convert score to rating with project-size and model awareness.
 *
 * Provides a more accurate rating by considering the target model's limits.
 *
 * @param score The numerical AI readiness score
 * @param fileCount Total number of files in the project
 * @param modelTier The model context tier being targeted
 * @returns The size-aware ReadinessRating
 */
export function getRatingWithContext(
  score: number,
  fileCount: number,
  modelTier: ModelContextTier = 'standard'
): ReadinessRating {
  const threshold = getRecommendedThreshold(fileCount, modelTier);
  const normalized =
    score - threshold + SCORING_CONSTANTS.THRESHOLDS.NORMALIZATION_OFFSET;
  return getRating(normalized);
}

/**
 * Get display properties (emoji and color) for a given rating.
 *
 * @param rating The readiness rating category
 * @returns Object containing display emoji and color string
 */
export function getRatingDisplay(rating: ReadinessRating | string): {
  emoji: string;
  color: string;
} {
  switch (rating) {
    case ReadinessRating.Excellent:
      return { emoji: '✅', color: 'green' };
    case ReadinessRating.Good:
      return { emoji: '👍', color: 'blue' };
    case ReadinessRating.Fair:
      return { emoji: '⚠️', color: 'yellow' };
    case ReadinessRating.NeedsWork:
      return { emoji: '🔨', color: 'orange' };
    case ReadinessRating.Critical:
      return { emoji: '❌', color: 'red' };
    default:
      return { emoji: '❓', color: 'gray' };
  }
}

/**
 * Format overall score for compact console display.
 *
 * @param result The consolidated scoring result
 * @returns Formatted string (e.g., "85/100 (Good) 👍")
 */
export function formatScore(result: ScoringResult): string {
  const { emoji } = getRatingDisplay(result.rating as ReadinessRating);
  return `${result.overall}/100 (${result.rating}) ${emoji}`;
}

/**
 * Format detailed tool score for expanded console display.
 *
 * Includes breakdown of influencing factors and actionable recommendations.
 *
 * @param output The scoring output for a single tool
 * @returns Multi-line formatted string for console output
 */
export function formatToolScore(output: ToolScoringOutput): string {
  let result = `  Score: ${output.score}/100\n\n`;

  if (output.factors && output.factors.length > 0) {
    result += `  Factors:\n`;
    output.factors.forEach((factor) => {
      const impactSign = factor.impact > 0 ? '+' : '';
      result += `    • ${factor.name}: ${impactSign}${factor.impact} - ${factor.description}\n`;
    });
    result += '\n';
  }

  if (output.recommendations && output.recommendations.length > 0) {
    result += `  Recommendations:\n`;
    output.recommendations.forEach((rec, i) => {
      let priorityIcon = '🔵';
      const prio = rec.priority as string;
      if (prio === RecommendationPriority.High || prio === 'high')
        priorityIcon = '🔴';
      else if (prio === RecommendationPriority.Medium || prio === 'medium')
        priorityIcon = '🟡';

      result += `    ${i + 1}. ${priorityIcon} ${rec.action}\n`;
      result += `       Impact: +${rec.estimatedImpact} points\n\n`;
    });
  }

  return result;
}
