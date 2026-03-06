import {
  ToolRegistry,
  ToolName,
  calculateOverallScore,
  calculateTokenBudget,
} from '@aiready/core';
import type {
  AnalysisResult,
  ScanOptions,
  SpokeOutput,
  ToolScoringOutput,
  ScoringResult,
} from '@aiready/core';

export type { ToolScoringOutput, ScoringResult };

export interface UnifiedAnalysisOptions extends ScanOptions {
  tools?: string[];
  minSimilarity?: number;
  minLines?: number;
  maxCandidatesPerBlock?: number;
  minSharedTokens?: number;
  useSmartDefaults?: boolean;
  consistency?: any;
  progressCallback?: (event: { tool: string; data: any }) => void;
}

export interface UnifiedAnalysisResult {
  // Dynamic keys based on ToolName
  [key: string]: any;

  summary: {
    totalIssues: number;
    toolsRun: string[];
    executionTime: number;
  };
  scoring?: ScoringResult;
}

/**
 * Mapping between ToolName and @aiready/ package names.
 * Used for dynamic registration on-demand.
 */
const TOOL_PACKAGE_MAP: Record<string, string> = {
  [ToolName.PatternDetect]: '@aiready/pattern-detect',
  [ToolName.ContextAnalyzer]: '@aiready/context-analyzer',
  [ToolName.NamingConsistency]: '@aiready/consistency',
  [ToolName.AiSignalClarity]: '@aiready/ai-signal-clarity',
  [ToolName.AgentGrounding]: '@aiready/agent-grounding',
  [ToolName.TestabilityIndex]: '@aiready/testability',
  [ToolName.DocDrift]: '@aiready/doc-drift',
  [ToolName.DependencyHealth]: '@aiready/deps',
  [ToolName.ChangeAmplification]: '@aiready/change-amplification',
  // Aliases handled by registry
  patterns: '@aiready/pattern-detect',
  context: '@aiready/context-analyzer',
  consistency: '@aiready/consistency',
};

/**
 * AIReady Unified Analysis
 * Orchestrates all registered tools via the ToolRegistry.
 */
export async function analyzeUnified(
  options: UnifiedAnalysisOptions
): Promise<UnifiedAnalysisResult> {
  const startTime = Date.now();
  const requestedTools = options.tools || [
    'patterns',
    'context',
    'consistency',
  ];

  const result: UnifiedAnalysisResult = {
    summary: {
      totalIssues: 0,
      toolsRun: [],
      executionTime: 0,
    },
  };

  for (const toolName of requestedTools) {
    let provider = ToolRegistry.find(toolName);

    // Dynamic Loading: If provider not found, attempt to import the package
    if (!provider) {
      const packageName =
        TOOL_PACKAGE_MAP[toolName] ||
        (toolName.startsWith('@aiready/') ? toolName : `@aiready/${toolName}`);
      try {
        await import(packageName);
        provider = ToolRegistry.find(toolName);
        if (provider) {
          console.log(
            `✅ Successfully loaded tool provider: ${toolName} from ${packageName}`
          );
        } else {
          console.log(
            `⚠️ Loaded ${packageName} but provider ${toolName} still not found in registry.`
          );
        }
      } catch (err: any) {
        console.log(
          `❌ Failed to dynamically load tool ${toolName} (${packageName}):`,
          err.message
        );
      }
    }

    if (!provider) {
      console.warn(
        `⚠️  Warning: Tool provider for '${toolName}' not found. Skipping.`
      );
      continue;
    }

    try {
      const output = await provider.analyze(options);

      if (options.progressCallback) {
        options.progressCallback({ tool: provider.id, data: output });
      }

      result[provider.id] = output;
      result.summary.toolsRun.push(provider.id);

      const issueCount = output.results.reduce(
        (sum: number, file: any) => sum + (file.issues?.length || 0),
        0
      );
      result.summary.totalIssues += issueCount;

      // Backward compatibility fallbacks
      if (provider.id === ToolName.PatternDetect) result.patternDetect = output;
      if (provider.id === ToolName.ContextAnalyzer)
        result.contextAnalyzer = output;
    } catch (err) {
      console.error(`❌ Error running tool '${provider.id}':`, err);
    }
  }

  result.summary.executionTime = Date.now() - startTime;
  return result;
}

/**
 * AIReady Unified Scoring
 * Calculates scores for all analyzed tools.
 */
export async function scoreUnified(
  results: UnifiedAnalysisResult,
  options: UnifiedAnalysisOptions
): Promise<ScoringResult> {
  const toolScores: Map<string, ToolScoringOutput> = new Map();

  for (const toolId of results.summary.toolsRun) {
    const provider = ToolRegistry.get(toolId as ToolName);
    if (!provider) continue;

    const output = results[toolId];
    if (!output) continue;

    try {
      const toolScore = provider.score(output, options);

      // Special handling for token budget calculation if not provided by tool
      if (!toolScore.tokenBudget) {
        if (toolId === ToolName.PatternDetect && (output as any).duplicates) {
          const wastedTokens = (output as any).duplicates.reduce(
            (sum: number, d: any) => sum + (d.tokenCost || 0),
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
              fragmentation: output.summary.totalPotentialSavings || 0,
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

  // Handle case where toolScores is empty
  if (toolScores.size === 0) {
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

  return calculateOverallScore(toolScores, options, undefined);
}

/**
 * Generate human-readable summary of unified results
 */
export function generateUnifiedSummary(result: UnifiedAnalysisResult): string {
  const { summary } = result;
  let output = `🚀 AIReady Analysis Complete\n\n`;
  output += `📊 Summary:\n`;
  output += `   Tools run: ${summary.toolsRun.join(', ')}\n`;
  output += `   Total issues found: ${summary.totalIssues}\n`;
  output += `   Execution time: ${(summary.executionTime / 1000).toFixed(2)}s\n\n`;

  for (const provider of ToolRegistry.getAll()) {
    const toolResult = result[provider.id];
    if (toolResult) {
      const issueCount = toolResult.results.reduce(
        (sum: number, r: any) => sum + (r.issues?.length || 0),
        0
      );
      output += `• ${provider.id}: ${issueCount} issues\n`;
    }
  }

  return output;
}
