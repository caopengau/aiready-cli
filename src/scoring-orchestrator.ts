import {
  ToolRegistry,
  ToolName,
  calculateOverallScore,
  calculateTokenBudget,
} from '@aiready/core';
import type { ToolScoringOutput, ScoringResult } from '@aiready/core';
import type { UnifiedAnalysisOptions, UnifiedAnalysisResult } from './options';

/**
 * AIReady Unified Scoring Orchestrator.
 * Handles the calculation of scores for all analyzed tools.
 */
export class ScoringOrchestrator {
  private registry: typeof ToolRegistry;

  /**
   * Initialize scoring orchestrator with a tool registry.
   * Injection pattern helps with testability and AI readiness score.
   */
  constructor(registry: typeof ToolRegistry = ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Calculates scores for all analyzed tools.
   */
  public async score(
    results: UnifiedAnalysisResult,
    options: UnifiedAnalysisOptions
  ): Promise<ScoringResult> {
    const toolScores: Map<string, ToolScoringOutput> = new Map();

    for (const toolId of results.summary.toolsRun) {
      const provider = this.registry.get(toolId as ToolName);
      if (!provider) continue;

      const output = results[toolId];
      if (!output) continue;

      try {
        const toolScore = provider.score(output, options);

        // Special handling for token budget calculation if not provided by tool
        if (!toolScore.tokenBudget) {
          if (toolId === ToolName.PatternDetect && (output as { duplicates?: Array<{ tokenCost?: number }> }).duplicates) {
            const wastedTokens = (output as { duplicates: Array<{ tokenCost?: number }> }).duplicates.reduce(
              (sum: number, d: any) => sum + (d.tokenCost ?? 0),
              0
            );
            toolScore.tokenBudget = calculateTokenBudget({
              totalContextTokens: wastedTokens * 2,
              wastedTokens: {
                duplication: wastedTokens,
                fragmentation: 0,
                chattiness: 0,
              },
            });
          } else if (toolId === ToolName.ContextAnalyzer && output.summary) {
            toolScore.tokenBudget = calculateTokenBudget({
              totalContextTokens: output.summary.totalTokens,
              wastedTokens: {
                duplication: 0,
                fragmentation: output.summary.totalPotentialSavings ?? 0,
                chattiness: 0,
              },
            });
          }
        }

        toolScores.set(toolId, toolScore);
      } catch (err) {
        console.error(`❌ Error scoring tool '${toolId}':`, err);
      }
    }

    if (toolScores.size === 0) {
      return this.emptyScoringResult();
    }

    return calculateOverallScore(toolScores, options, undefined);
  }

  /**
   * Generate human-readable summary of unified results.
   */
  public generateSummary(result: UnifiedAnalysisResult): string {
    const { summary } = result;
    let output = `🚀 AIReady Analysis Complete\n\n`;
    output += `📊 Summary:\n`;
    output += `   Tools run: ${summary.toolsRun.join(', ')}\n`;
    output += `   Total issues found: ${summary.totalIssues}\n`;
    output += `   Execution time: ${(summary.executionTime / 1000).toFixed(2)}s\n\n`;

    for (const provider of this.registry.getAll()) {
      const toolResult = result[provider.id];
      if (toolResult) {
        const issueCount = toolResult.results.reduce(
          (sum: number, r: any) => sum + (r.issues?.length ?? 0),
          0
        );
        output += `• ${provider.id}: ${issueCount} issues\n`;
      }
    }

    return output;
  }

  private emptyScoringResult(): ScoringResult {
    return {
      overall: 0,
      rating: 'Critical',
      timestamp: new Date().toISOString(),
      toolsUsed: [],
      breakdown: [],
      calculation: {
        formula: '0 / 0 = 0',
        weights: {},
        normalized: '0 / 0 = 0',
      },
    } as ScoringResult;
  }
}

/**
 * Backward compatible wrapper for the scoring orchestrator.
 */
export async function scoreUnified(
  results: UnifiedAnalysisResult,
  options: UnifiedAnalysisOptions
): Promise<ScoringResult> {
  const orchestrator = new ScoringOrchestrator(ToolRegistry);
  return orchestrator.score(results, options);
}

/**
 * Backward compatible wrapper for the summary generation.
 */
export function generateUnifiedSummary(result: UnifiedAnalysisResult): string {
  const orchestrator = new ScoringOrchestrator(ToolRegistry);
  return orchestrator.generateSummary(result);
}
