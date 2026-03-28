import {
  scanFiles,
  Severity,
  IssueType,
  getSeverityLevel,
} from '@aiready/core';
import type { AnalysisResult, Issue } from '@aiready/core';
import type {
  ConsistencyOptions,
  ConsistencyReport,
  ConsistencyIssue,
} from './types';
import { analyzeNamingAST } from './analyzers/naming-ast';
import { analyzeNamingGeneralized } from './analyzers/naming-generalized';
import { analyzePatterns } from './analyzers/patterns';
import { calculateConsistencyScore as calculateConsistencyScoreFromScoring } from './scoring';

/**
 * Main consistency analyzer that orchestrates all analysis types.
 * Supports: TypeScript, JavaScript, Python, Java, C#, Go.
 *
 * @param options - Configuration for consistency analysis and file scanning.
 * @returns Promise resolving to the comprehensive consistency report.
 * @lastUpdated 2026-03-18
 */
export async function analyzeConsistency(
  options: ConsistencyOptions
): Promise<ConsistencyReport> {
  const {
    checkNaming = true,
    checkPatterns = true,
    checkArchitecture = false, // Not implemented yet
    minSeverity = Severity.Info,
    ...scanOptions
  } = options;

  // Mark intentionally-unused option to avoid lint warnings
  void checkArchitecture;

  // Scan files
  const filePaths = await scanFiles(scanOptions);

  // Collect issues by category
  let namingIssues: Array<{
    fileName?: string;
    file?: string;
    filePath?: string;
    line?: number;
    column?: number;
    identifier?: string;
    type?: string;
    severity: Severity;
    message?: string;
    suggestion?: string;
    description?: string;
    files?: string[];
    examples?: string[];
    location?: { file: string; line: number; column: number };
  }> = [];
  if (checkNaming) {
    // 1. Generalized naming analysis for all supported files
    namingIssues = await analyzeNamingGeneralized(filePaths);

    // 2. Targeted deep AST analysis for TS/JS (handled by specialized analyzer)
    const tsJsFiles = filePaths.filter((f) => /\.(ts|tsx|js|jsx)$/i.test(f));
    if (tsJsFiles.length > 0) {
      const deepTsIssues = await analyzeNamingAST(tsJsFiles);
      // Merge issues, avoiding duplicates for exports if already checked
      namingIssues = [...namingIssues, ...deepTsIssues];
    }
  }

  const patternIssues = checkPatterns ? await analyzePatterns(filePaths) : [];

  // Convert to AnalysisResult format
  const results: AnalysisResult[] = [];
  const fileIssuesMap = new Map<string, ConsistencyIssue[]>();

  // Process naming issues
  for (const issue of namingIssues) {
    if (!shouldIncludeSeverity(issue.severity, minSeverity)) continue;

    const fileName =
      issue.fileName || issue.file || issue.filePath || 'unknown';
    if (!fileIssuesMap.has(fileName)) fileIssuesMap.set(fileName, []);
    fileIssuesMap.get(fileName)!.push(issue as unknown as ConsistencyIssue);
  }

  // Process pattern issues
  for (const issue of patternIssues) {
    if (!shouldIncludeSeverity(issue.severity, minSeverity)) continue;

    const anyIssue = issue as any;
    const fileName =
      (anyIssue.fileName as string) ||
      (anyIssue.file as string) ||
      (anyIssue.filePath as string) ||
      (Array.isArray(issue.files) ? (issue.files[0] as string) : 'unknown');
    if (!fileIssuesMap.has(fileName)) fileIssuesMap.set(fileName, []);
    fileIssuesMap.get(fileName)!.push(issue as unknown as ConsistencyIssue);
  }

  // Build final results
  for (const [fileName, issues] of fileIssuesMap.entries()) {
    const scoreResult = calculateConsistencyScoreFromScoring(
      issues,
      filePaths.length
    );
    results.push({
      fileName,
      issues: issues.map((i) => transformToIssue(i)),
      metrics: {
        consistencyScore: scoreResult.score / 100,
      },
    });
  }

  // Generate high-level recommendations
  const recommendations: string[] = [];
  if (namingIssues.length > 0) {
    recommendations.push('Standardize naming conventions across the codebase');
  }
  if (patternIssues.length > 0) {
    recommendations.push('Consolidate repetitive implementation patterns');
  }
  if (results.some((r) => (r.metrics?.consistencyScore ?? 1) < 0.8)) {
    recommendations.push(
      'Improve cross-module consistency to reduce AI confusion'
    );
  }

  return {
    results,
    summary: {
      filesAnalyzed: filePaths.length,
      totalIssues: results.reduce((acc, r) => acc + r.issues.length, 0),
      namingIssues: namingIssues.length,
      patternIssues: patternIssues.length,
      architectureIssues: 0,
    },
    recommendations,
    metadata: {
      toolName: 'naming-consistency',
      timestamp: new Date().toISOString(),
    },
  } as unknown as ConsistencyReport;
}

/**
 * Check if an issue severity meets the minimum threshold.
 *
 * @param severity - The severity of the issue.
 * @param minSeverity - The minimum severity threshold.
 * @returns True if severity is greater than or equal to minSeverity.
 */
function shouldIncludeSeverity(
  severity: Severity | string,
  minSeverity: Severity | string
): boolean {
  return getSeverityLevel(severity) >= getSeverityLevel(minSeverity);
}

/**
 * Map string type to IssueType enum value.
 *
 * @param type - The raw issue type string.
 * @returns Normalized IssueType enum.
 */
function getIssueType(type: string | undefined): IssueType {
  if (!type) return IssueType.NamingInconsistency;

  // Map string values to enum
  const typeMap: Record<string, IssueType> = {
    'naming-inconsistency': IssueType.NamingInconsistency,
    'naming-quality': IssueType.NamingQuality,
    'pattern-inconsistency': IssueType.PatternInconsistency,
    'architecture-inconsistency': IssueType.ArchitectureInconsistency,
    'error-handling': IssueType.PatternInconsistency,
    'async-style': IssueType.PatternInconsistency,
    'import-style': IssueType.PatternInconsistency,
    'api-design': IssueType.PatternInconsistency,
  };

  return typeMap[type] || IssueType.NamingInconsistency;
}

/**
 * Transform NamingIssue or PatternIssue to the required Issue format.
 *
 * @param i - The raw issue object to transform.
 * @returns Standardized Issue object.
 */
function transformToIssue(i: any): Issue {
  // If already has message and location, return as is
  if (i.message && i.location) {
    return {
      type: getIssueType(i.type),
      severity: i.severity as Severity,
      message: i.message,
      location: i.location,
      suggestion: i.suggestion,
    };
  }

  // Handle NamingIssue format (has file, line, column, identifier, suggestion)
  if (i.identifier || i.type) {
    const line = i.line || 1;
    const column = i.column || 1;
    return {
      type: getIssueType(i.type),
      severity: i.severity as Severity,
      message: i.suggestion
        ? `Naming issue: ${i.suggestion}`
        : `Naming issue for '${i.identifier || 'unknown'}'`,
      location: {
        file: i.file || i.fileName || '',
        line,
        column,
        endLine: line,
        endColumn: column + (i.identifier?.length || 10),
      },
      suggestion: i.suggestion,
    };
  }

  // Handle PatternIssue format (has description, files)
  if (i.description || i.files) {
    const fileName = Array.isArray(i.files) ? i.files[0] : i.file || '';
    return {
      type: getIssueType(i.type),
      severity: i.severity as Severity,
      message: i.description || 'Pattern inconsistency found',
      location: {
        file: fileName,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 10,
      },
      suggestion: i.examples?.[0],
    };
  }

  // Fallback
  return {
    type: getIssueType(i.type),
    severity: i.severity as Severity,
    message: i.message || 'Unknown issue',
    location: i.location || { file: '', line: 1, column: 1 },
    suggestion: i.suggestion,
  };
}
