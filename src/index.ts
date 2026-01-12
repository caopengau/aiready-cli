import { analyzePatterns } from '@aiready/pattern-detect';
import { analyzeContext } from '@aiready/context-analyzer';
import type { AnalysisResult, ScanOptions } from '@aiready/core';
import type { ContextAnalysisResult } from '@aiready/context-analyzer';

export interface UnifiedAnalysisOptions extends ScanOptions {
  tools?: ('patterns' | 'context')[];
}

export interface UnifiedAnalysisResult {
  patterns?: AnalysisResult[];
  context?: ContextAnalysisResult[];
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
  const tools = options.tools || ['patterns', 'context'];
  const result: UnifiedAnalysisResult = {
    summary: {
      totalIssues: 0,
      toolsRun: tools,
      executionTime: 0,
    },
  };

  // Run pattern detection
  if (tools.includes('patterns')) {
    result.patterns = await analyzePatterns(options);
    result.summary.totalIssues += result.patterns.length;
  }

  // Run context analysis
  if (tools.includes('context')) {
    result.context = await analyzeContext(options);
    result.summary.totalIssues += result.context?.length || 0;
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

  return output;
}