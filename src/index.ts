import { analyzePatterns } from '@aiready/pattern-detect';
import { analyzeContext } from '@aiready/context-analyzer';
import { analyzeConsistency } from '@aiready/consistency';
import type { AnalysisResult, ScanOptions, SpokeOutput } from '@aiready/core';
import {
  calculateOverallScore,
  type ToolScoringOutput,
  type ScoringResult,
  calculateTokenBudget,
} from '@aiready/core';
export type { ToolScoringOutput, ScoringResult };

export interface UnifiedAnalysisOptions extends ScanOptions {
  tools?: (
    | 'patterns'
    | 'context'
    | 'consistency'
    | 'doc-drift'
    | 'deps-health'
    | 'ai-signal-clarity'
    | 'agent-grounding'
    | 'testability'
    | 'change-amplification'
  )[];
  minSimilarity?: number;
  minLines?: number;
  maxCandidatesPerBlock?: number;
  minSharedTokens?: number;
  useSmartDefaults?: boolean;
  consistency?: any;
  progressCallback?: (event: { tool: string; data: any }) => void;
}

export interface UnifiedAnalysisResult {
  // Standardized keys matching tool names
  patternDetect?: SpokeOutput & { duplicates: any[] };
  contextAnalyzer?: SpokeOutput;
  consistency?: SpokeOutput;
  docDrift?: SpokeOutput;
  dependencyHealth?: SpokeOutput;
  aiSignalClarity?: SpokeOutput;
  agentGrounding?: SpokeOutput;
  testability?: SpokeOutput;
  changeAmplification?: SpokeOutput;

  summary: {
    totalIssues: number;
    toolsRun: string[];
    executionTime: number;
  };
  scoring?: ScoringResult;
}

// Severity ordering (higher number = more severe)
const severityOrder: Record<string, number> = {
  critical: 4,
  major: 3,
  minor: 2,
  info: 1,
};

function sortBySeverity(results: AnalysisResult[]): AnalysisResult[] {
  return results
    .map((file) => {
      // Sort issues within each file by severity (most severe first)
      const sortedIssues = [...file.issues].sort((a, b) => {
        const severityDiff =
          (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        // If same severity, sort by line number
        return (a.location?.line || 0) - (b.location?.line || 0);
      });
      return { ...file, issues: sortedIssues };
    })
    .sort((a, b) => {
      // Sort files by most severe issue first
      const aMaxSeverity = Math.max(
        ...a.issues.map((i) => severityOrder[i.severity] || 0),
        0
      );
      const bMaxSeverity = Math.max(
        ...b.issues.map((i) => severityOrder[i.severity] || 0),
        0
      );
      if (aMaxSeverity !== bMaxSeverity) {
        return bMaxSeverity - aMaxSeverity;
      }
      // If same max severity, sort by number of issues
      if (a.issues.length !== b.issues.length) {
        return b.issues.length - a.issues.length;
      }
      // Finally, sort alphabetically by filename
      return a.fileName.localeCompare(b.fileName);
    });
}

export async function analyzeUnified(
  options: UnifiedAnalysisOptions
): Promise<UnifiedAnalysisResult> {
  const startTime = Date.now();
  const tools = options.tools || ['patterns', 'context', 'consistency'];
  // Tools requested and effective options are used from `options`
  const result: UnifiedAnalysisResult = {
    summary: {
      totalIssues: 0,
      toolsRun: tools,
      executionTime: 0,
    },
  };

  // Run pattern detection
  if (tools.includes('patterns')) {
    const patternResult = await analyzePatterns(options);
    if (options.progressCallback) {
      options.progressCallback({ tool: 'patterns', data: patternResult });
    }
    result.patternDetect = {
      results: sortBySeverity(patternResult.results),
      summary: patternResult.summary || {},
      duplicates: patternResult.duplicates || [],
    };
    result.summary.totalIssues += patternResult.results.reduce(
      (sum, file) => sum + file.issues.length,
      0
    );
  }

  // Run context analysis
  if (tools.includes('context')) {
    const contextResults = await analyzeContext(options);
    if (options.progressCallback) {
      options.progressCallback({ tool: 'context', data: contextResults });
    }
    const sorted = contextResults.sort((a, b) => {
      const severityDiff =
        (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      if (a.tokenCost !== b.tokenCost) return b.tokenCost - a.tokenCost;
      return b.fragmentationScore - a.fragmentationScore;
    });

    const { generateSummary: genContextSummary } =
      await import('@aiready/context-analyzer');
    result.contextAnalyzer = {
      results: sorted,
      summary: genContextSummary(sorted),
    };
    result.summary.totalIssues += sorted.length;
  }

  // Run consistency analysis
  if (tools.includes('consistency')) {
    const consistencyOptions = {
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
      ...(options.consistency || {}),
    };
    const report = await analyzeConsistency(consistencyOptions);
    if (options.progressCallback) {
      options.progressCallback({ tool: 'consistency', data: report });
    }
    result.consistency = {
      results: report.results ? sortBySeverity(report.results) : [],
      summary: report.summary,
    };
    result.summary.totalIssues += report.summary.totalIssues;
  }

  // Run Documentation Drift analysis
  if (tools.includes('doc-drift')) {
    const { analyzeDocDrift } = await import('@aiready/doc-drift');
    const report = await analyzeDocDrift({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
      onProgress: options.onProgress,
    });
    if (options.progressCallback) {
      options.progressCallback({ tool: 'doc-drift', data: report });
    }
    result.docDrift = {
      results: report.results || [],
      summary: report.summary || {},
    };
    result.summary.totalIssues += report.issues?.length || 0;
  }

  // Run Dependency Health analysis
  if (tools.includes('deps-health')) {
    const { analyzeDeps } = await import('@aiready/deps');
    const report = await analyzeDeps({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
      onProgress: options.onProgress,
    });
    if (options.progressCallback) {
      options.progressCallback({ tool: 'deps-health', data: report });
    }
    result.dependencyHealth = {
      results: report.results || [],
      summary: report.summary || {},
    };
    result.summary.totalIssues += report.issues?.length || 0;
  }

  // Run AI Signal Clarity analysis
  if (tools.includes('ai-signal-clarity')) {
    const { analyzeAiSignalClarity } =
      await import('@aiready/ai-signal-clarity');
    const report = await analyzeAiSignalClarity({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
      onProgress: options.onProgress,
    });
    if (options.progressCallback) {
      options.progressCallback({ tool: 'ai-signal-clarity', data: report });
    }
    result.aiSignalClarity = {
      results: report.results || [],
      summary: report.summary || {},
    };
    result.summary.totalIssues +=
      report.results?.reduce(
        (sum: number, r: any) => sum + (r.issues?.length || 0),
        0
      ) || 0;
  }

  // Run Agent Grounding analysis
  if (tools.includes('agent-grounding')) {
    const { analyzeAgentGrounding } = await import('@aiready/agent-grounding');
    const report = await analyzeAgentGrounding({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
      onProgress: options.onProgress,
    });
    if (options.progressCallback) {
      options.progressCallback({ tool: 'agent-grounding', data: report });
    }
    result.agentGrounding = {
      results: report.results || [],
      summary: report.summary || {},
    };
    result.summary.totalIssues += report.issues?.length || 0;
  }

  // Run Testability analysis
  if (tools.includes('testability')) {
    const { analyzeTestability } = await import('@aiready/testability');
    const report = await analyzeTestability({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
      onProgress: options.onProgress,
    });
    if (options.progressCallback) {
      options.progressCallback({ tool: 'testability', data: report });
    }
    result.testability = {
      results: report.results || [],
      summary: report.summary || {},
    };
    result.summary.totalIssues += report.issues?.length || 0;
  }

  // Run Change Amplification analysis
  if (tools.includes('change-amplification')) {
    const { analyzeChangeAmplification } =
      await import('@aiready/change-amplification');
    const report = await analyzeChangeAmplification({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
      onProgress: options.onProgress,
    });
    if (options.progressCallback) {
      options.progressCallback({ tool: 'change-amplification', data: report });
    }
    result.changeAmplification = {
      results: report.results || [],
      summary: report.summary || {},
    };
    result.summary.totalIssues += report.summary?.totalIssues || 0;
  }

  result.summary.executionTime = Date.now() - startTime;
  return result;
}

export async function scoreUnified(
  results: UnifiedAnalysisResult,
  options: UnifiedAnalysisOptions
): Promise<ScoringResult> {
  const toolScores: Map<string, ToolScoringOutput> = new Map();

  // Patterns score
  if (results.patternDetect) {
    const { calculatePatternScore } = await import('@aiready/pattern-detect');
    try {
      const patternScore = calculatePatternScore(
        results.patternDetect.duplicates,
        results.patternDetect.results?.length || 0
      );

      // Calculate token budget for patterns (waste = duplication)
      const wastedTokens = results.patternDetect.duplicates.reduce(
        (sum: number, d: any) => sum + (d.tokenCost || 0),
        0
      );
      patternScore.tokenBudget = calculateTokenBudget({
        totalContextTokens: wastedTokens * 2, // Estimated context
        wastedTokens: {
          duplication: wastedTokens,
          fragmentation: 0,
          chattiness: 0,
        },
      });

      toolScores.set('pattern-detect', patternScore);
    } catch (err) {
      void err;
    }
  }

  // Context score
  if (results.contextAnalyzer) {
    const { calculateContextScore } = await import('@aiready/context-analyzer');
    try {
      const ctxSummary = results.contextAnalyzer.summary;
      const contextScore = calculateContextScore(ctxSummary);

      // Calculate token budget for context (waste = fragmentation + depth overhead)
      contextScore.tokenBudget = calculateTokenBudget({
        totalContextTokens: ctxSummary.totalTokens,
        wastedTokens: {
          duplication: 0,
          fragmentation: ctxSummary.totalPotentialSavings || 0,
          chattiness: 0,
        },
      });

      toolScores.set('context-analyzer', contextScore);
    } catch (err) {
      void err;
    }
  }

  // Consistency score
  if (results.consistency) {
    const { calculateConsistencyScore } = await import('@aiready/consistency');
    try {
      const issues =
        results.consistency.results?.flatMap((r: any) => r.issues) || [];
      const totalFiles = results.consistency.summary?.filesAnalyzed || 0;
      const consistencyScore = calculateConsistencyScore(issues, totalFiles);
      toolScores.set('consistency', consistencyScore);
    } catch (err) {
      void err;
    }
  }

  // AI signal clarity score
  if (results.aiSignalClarity) {
    const { calculateAiSignalClarityScore } =
      await import('@aiready/ai-signal-clarity');
    try {
      const hrScore = calculateAiSignalClarityScore(results.aiSignalClarity);
      toolScores.set('ai-signal-clarity', hrScore);
    } catch (err) {
      void err;
    }
  }

  // Agent grounding score
  if (results.agentGrounding) {
    const { calculateGroundingScore } =
      await import('@aiready/agent-grounding');
    try {
      const agScore = calculateGroundingScore(results.agentGrounding);
      toolScores.set('agent-grounding', agScore);
    } catch (err) {
      void err;
    }
  }

  // Testability score
  if (results.testability) {
    const { calculateTestabilityScore } = await import('@aiready/testability');
    try {
      const tbScore = calculateTestabilityScore(results.testability);
      toolScores.set('testability', tbScore);
    } catch (err) {
      void err;
    }
  }

  // Documentation Drift score
  if (results.docDrift) {
    toolScores.set('doc-drift', {
      toolName: 'doc-drift',
      score:
        results.docDrift.summary.score ||
        results.docDrift.summary.totalScore ||
        0,
      rawMetrics: results.docDrift.summary,
      factors: [],
      recommendations: (results.docDrift.summary.recommendations || []).map(
        (action: string) => ({
          action,
          estimatedImpact: 5,
          priority: 'medium',
        })
      ),
    });
  }

  // Dependency Health score
  if (results.dependencyHealth) {
    toolScores.set('dependency-health', {
      toolName: 'dependency-health',
      score: results.dependencyHealth.summary.score || 0,
      rawMetrics: results.dependencyHealth.summary,
      factors: [],
      recommendations: (
        results.dependencyHealth.summary.recommendations || []
      ).map((action: string) => ({
        action,
        estimatedImpact: 5,
        priority: 'medium',
      })),
    });
  }

  // Change Amplification score
  if (results.changeAmplification) {
    toolScores.set('change-amplification', {
      toolName: 'change-amplification',
      score: results.changeAmplification.summary.score || 0,
      rawMetrics: results.changeAmplification.summary,
      factors: [],
      recommendations: (
        results.changeAmplification.summary.recommendations || []
      ).map((action: string) => ({
        action,
        estimatedImpact: 5,
        priority: 'medium',
      })),
    });
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

export function generateUnifiedSummary(result: UnifiedAnalysisResult): string {
  const { summary } = result;
  let output = `🚀 AIReady Analysis Complete\n\n`;
  output += `📊 Summary:\n`;
  output += `   Tools run: ${summary.toolsRun.join(', ')}\n`;
  output += `   Total issues found: ${summary.totalIssues}\n`;
  output += `   Execution time: ${(summary.executionTime / 1000).toFixed(2)}s\n\n`;

  if (result.patternDetect) {
    output += `🔍 Pattern Analysis: ${result.patternDetect.results.length} issues\n`;
  }

  if (result.contextAnalyzer) {
    output += `🧠 Context Analysis: ${result.contextAnalyzer.results.length} issues\n`;
  }

  if (result.consistency) {
    output += `🏷️ Consistency Analysis: ${result.consistency.summary.totalIssues} issues\n`;
  }

  if (result.docDrift) {
    output += `📝 Doc Drift Analysis: ${result.docDrift.results?.length || 0} issues\n`;
  }

  if (result.dependencyHealth) {
    output += `📦 Dependency Health: ${result.dependencyHealth.results?.length || 0} issues\n`;
  }

  if (result.aiSignalClarity) {
    output += `🧠 AI Signal Clarity: ${result.aiSignalClarity.summary?.totalSignals || 0} signals\n`;
  }

  if (result.agentGrounding) {
    output += `🧭 Agent Grounding: ${result.agentGrounding.results?.length || 0} issues\n`;
  }

  if (result.testability) {
    output += `🧪 Testability Index: ${result.testability.results?.length || 0} issues\n`;
  }

  if (result.changeAmplification) {
    output += `💥 Change Amplification: ${result.changeAmplification.summary?.totalIssues || 0} cascading risks\n`;
  }

  return output;
}
