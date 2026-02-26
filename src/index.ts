import { analyzePatterns } from '@aiready/pattern-detect';
import { analyzeContext } from '@aiready/context-analyzer';
import { analyzeConsistency } from '@aiready/consistency';
import type { AnalysisResult, ScanOptions } from '@aiready/core';
import type { ContextAnalysisResult } from '@aiready/context-analyzer';
import type { PatternDetectOptions, DuplicatePattern } from '@aiready/pattern-detect';
import type { ConsistencyReport } from '@aiready/consistency';

import type { ConsistencyOptions } from '@aiready/consistency';

export interface UnifiedAnalysisOptions extends ScanOptions {
  tools?: ('patterns' | 'context' | 'consistency' | 'doc-drift' | 'deps-health')[];
  minSimilarity?: number;
  minLines?: number;
  maxCandidatesPerBlock?: number;
  minSharedTokens?: number;
  useSmartDefaults?: boolean;
  consistency?: Partial<ConsistencyOptions>;
  progressCallback?: (event: { tool: string; data: any }) => void;
}

export interface UnifiedAnalysisResult {
  patterns?: AnalysisResult[];
  duplicates?: DuplicatePattern[]; // Store actual duplicates for scoring
  context?: ContextAnalysisResult[];
  consistency?: ConsistencyReport;
  docDrift?: any;
  deps?: any;
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
    // Emit progress for patterns
    if (options.progressCallback) {
      options.progressCallback({ tool: 'patterns', data: patternResult });
    }
    // Sort results by severity
    result.patterns = sortBySeverity(patternResult.results);
    // Store duplicates for scoring
    result.duplicates = patternResult.duplicates;
    // Count actual issues, not file count
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
    // Use config fields if present, fallback to defaults
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
    // Sort consistency results by severity
    if (report.results) {
      report.results = sortBySeverity(report.results);
    }
    result.consistency = report;
    result.summary.totalIssues += report.summary.totalIssues;
  }

  // Run Documentation Drift analysis
  if (tools.includes('doc-drift')) {
    const { analyzeDocDrift } = await import('@aiready/doc-drift');
    const report = await analyzeDocDrift({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
    });
    if (options.progressCallback) {
      options.progressCallback({ tool: 'doc-drift', data: report });
    }
    result.docDrift = report;
    result.summary.totalIssues += report.issues?.length || 0;
  }

  // Run Dependency Health analysis
  if (tools.includes('deps-health')) {
    const { analyzeDeps } = await import('@aiready/deps');
    const report = await analyzeDeps({
      rootDir: options.rootDir,
      include: options.include,
      exclude: options.exclude,
    });
    if (options.progressCallback) {
      options.progressCallback({ tool: 'deps-health', data: report });
    }
    result.deps = report;
    result.summary.totalIssues += report.issues?.length || 0;
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

  if (result.patterns) {
    output += `🔍 Pattern Analysis: ${result.patterns.length} issues\n`;
  }

  if (result.context) {
    output += `🧠 Context Analysis: ${result.context.length} issues\n`;
  }

  if (result.consistency) {
    output += `🏷️ Consistency Analysis: ${result.consistency.summary.totalIssues} issues\n`;
  }

  if (result.docDrift) {
    output += `📝 Doc Drift Analysis: ${result.docDrift.issues?.length || 0} issues\n`;
  }

  if (result.deps) {
    output += `📦 Dependency Health: ${result.deps.issues?.length || 0} issues\n`;
  }

  return output;
}