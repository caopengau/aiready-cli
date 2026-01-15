import { analyzePatterns } from '@aiready/pattern-detect';
import { analyzeContext } from '@aiready/context-analyzer';
import { analyzeConsistency } from '@aiready/consistency';
import type { AnalysisResult, ScanOptions } from '@aiready/core';
import type { ContextAnalysisResult } from '@aiready/context-analyzer';
import type { PatternDetectOptions } from '@aiready/pattern-detect';
import type { ConsistencyReport } from '@aiready/consistency';

export interface UnifiedAnalysisOptions extends ScanOptions {
  tools?: ('patterns' | 'context' | 'consistency')[];
  minSimilarity?: number;
  minLines?: number;
  maxCandidatesPerBlock?: number;
  minSharedTokens?: number;
  useSmartDefaults?: boolean;
}

export interface UnifiedAnalysisResult {
  patterns?: AnalysisResult[];
  context?: ContextAnalysisResult[];
  consistency?: ConsistencyReport;
  summary: {
    totalIssues: number;
    toolsRun: string[];
    executionTime: number;
  };
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
        const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        // If same severity, sort by line number
        return (a.location?.line || 0) - (b.location?.line || 0);
      });
      return { ...file, issues: sortedIssues };
    })
    .sort((a, b) => {
      // Sort files by most severe issue first
      const aMaxSeverity = Math.max(...a.issues.map((i) => severityOrder[i.severity] || 0), 0);
      const bMaxSeverity = Math.max(...b.issues.map((i) => severityOrder[i.severity] || 0), 0);
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
    // Sort results by severity
    result.patterns = sortBySeverity(patternResult.results);
    // Count actual issues, not file count
    result.summary.totalIssues += patternResult.results.reduce(
      (sum, file) => sum + file.issues.length,
      0
    );
  }

  // Run context analysis
  if (tools.includes('context')) {
    const contextResults = await analyzeContext(options);
    // Sort context results by severity (most severe first)
    result.context = contextResults.sort((a, b) => {
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      // If same severity, sort by token cost (higher cost first)
      if (a.tokenCost !== b.tokenCost) return b.tokenCost - a.tokenCost;
      // Finally, sort by fragmentation score (higher fragmentation first)
      return b.fragmentationScore - a.fragmentationScore;
    });
    result.summary.totalIssues += result.context?.length || 0;
  }

  // Run consistency analysis
  if (tools.includes('consistency')) {
    const report = await analyzeConsistency({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
      checkNaming: true,
      checkPatterns: true,
      minSeverity: 'info',
    });
    // Sort consistency results by severity
    if (report.results) {
      report.results = sortBySeverity(report.results);
    }
    result.consistency = report;
    result.summary.totalIssues += report.summary.totalIssues;
  }

  result.summary.executionTime = Date.now() - startTime;
  return result;
}

export function generateUnifiedSummary(result: UnifiedAnalysisResult): string {
  const { summary } = result;
  let output = `🚀 AIReady Analysis Complete\n\n`;
  output += `📊 Summary:\n`;
  output += `   Tools run: ${summary.toolsRun.join(', ')}\n`;
  output += `   Total issues found: ${summary.totalIssues}\n`;
  output += `   Execution time: ${(summary.executionTime / 1000).toFixed(2)}s\n\n`;

  if (result.patterns?.length) {
    output += `🔍 Pattern Analysis: ${result.patterns.length} issues\n`;
  }

  if (result.context?.length) {
    output += `🧠 Context Analysis: ${result.context.length} issues\n`;
  }

  if (result.consistency) {
    output += `🏷️ Consistency Analysis: ${result.consistency.summary.totalIssues} issues\n`;
  }

  return output;
}