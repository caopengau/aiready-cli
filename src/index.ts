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
    result.patterns = patternResult.results;
    result.summary.totalIssues += patternResult.results.length;
  }

  // Run context analysis
  if (tools.includes('context')) {
    result.context = await analyzeContext(options);
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