import { scanFiles, readFileContent } from '@aiready/core';
import type { AnalysisResult, Issue, ScanOptions } from '@aiready/core';
import { detectDuplicatePatterns, type PatternType } from './detector';

export interface PatternDetectOptions extends ScanOptions {
  minSimilarity?: number; // 0-1, default 0.40 (Jaccard similarity)
  minLines?: number; // Minimum lines to consider, default 5
  maxBlocks?: number; // Maximum blocks to analyze (prevents OOM), default 500
  batchSize?: number; // Batch size for comparisons, default 100
  approx?: boolean; // Use approximate candidate selection (default true)
  minSharedTokens?: number; // Minimum shared tokens to consider a candidate, default 8
  maxCandidatesPerBlock?: number; // Cap candidates per block, default 100
  maxComparisons?: number; // Maximum total comparisons budget, default 50000
  streamResults?: boolean; // Output duplicates incrementally as found (default false)
}

export interface PatternSummary {
  totalPatterns: number;
  totalTokenCost: number;
  patternsByType: Record<PatternType, number>;
  topDuplicates: Array<{
    file1: string;
    file2: string;
    line1: number;
    line2: number;
    endLine1: number;
    endLine2: number;
    similarity: number;
    patternType: PatternType;
    tokenCost: number;
  }>;
}

/**
 * Generate refactoring suggestion based on pattern type
 */
function getRefactoringSuggestion(
  patternType: PatternType,
  similarity: number
): string {
  const baseMessages: Record<PatternType, string> = {
    'api-handler': 'Extract common middleware or create a base handler class',
    validator:
      'Consolidate validation logic into shared schema validators (Zod/Yup)',
    utility: 'Move to a shared utilities file and reuse across modules',
    'class-method': 'Consider inheritance or composition to share behavior',
    component: 'Extract shared logic into a custom hook or HOC',
    function: 'Extract into a shared helper function',
    unknown: 'Extract common logic into a reusable module',
  };

  const urgency =
    similarity > 0.95
      ? ' (CRITICAL: Nearly identical code)'
      : similarity > 0.9
      ? ' (HIGH: Very similar, refactor soon)'
      : '';

  return baseMessages[patternType] + urgency;
}

export async function analyzePatterns(
  options: PatternDetectOptions
): Promise<AnalysisResult[]> {
  const {
    minSimilarity = 0.4, // Jaccard similarity default (40% threshold)
    minLines = 5,
    maxBlocks = 500,
    batchSize = 100,
    approx = true,
    minSharedTokens = 8,
    maxCandidatesPerBlock = 100,
    maxComparisons = 50000,
    streamResults = false,
    ...scanOptions
  } = options;

  const files = await scanFiles(scanOptions);
  const results: AnalysisResult[] = [];

  // Read all files
  const fileContents = await Promise.all(
    files.map(async (file) => ({
      file,
      content: await readFileContent(file),
    }))
  );

  // Detect duplicate patterns across all files
  const duplicates = await detectDuplicatePatterns(fileContents, {
    minSimilarity,
    minLines,
    maxBlocks,
    batchSize,
    approx,
    minSharedTokens,
    maxCandidatesPerBlock,
    maxComparisons,
    streamResults,
  });

  for (const file of files) {
    const fileDuplicates = duplicates.filter(
      (dup) => dup.file1 === file || dup.file2 === file
    );

    const issues: Issue[] = fileDuplicates.map((dup) => {
      const otherFile = dup.file1 === file ? dup.file2 : dup.file1;
      const severity: Issue['severity'] =
        dup.similarity > 0.95
          ? 'critical'
          : dup.similarity > 0.9
          ? 'major'
          : 'minor';

      return {
        type: 'duplicate-pattern' as const,
        severity,
        message: `${dup.patternType} pattern ${Math.round(dup.similarity * 100)}% similar to ${otherFile} (${dup.tokenCost} tokens wasted)`,
        location: {
          file,
          line: dup.file1 === file ? dup.line1 : dup.line2,
        },
        suggestion: getRefactoringSuggestion(dup.patternType, dup.similarity),
      };
    });

    const totalTokenCost = fileDuplicates.reduce(
      (sum, dup) => sum + dup.tokenCost,
      0
    );

    results.push({
      fileName: file,
      issues,
      metrics: {
        tokenCost: totalTokenCost,
        consistencyScore: Math.max(0, 1 - fileDuplicates.length * 0.1),
      },
    });
  }

  return results;
}

/**
 * Generate a summary of pattern analysis
 */
export function generateSummary(
  results: AnalysisResult[]
): PatternSummary {
  const allIssues = results.flatMap((r) => r.issues);
  const totalTokenCost = results.reduce(
    (sum, r) => sum + (r.metrics.tokenCost || 0),
    0
  );

  // Count patterns by type (extract from messages)
  const patternsByType: Record<PatternType, number> = {
    'api-handler': 0,
    validator: 0,
    utility: 0,
    'class-method': 0,
    component: 0,
    function: 0,
    unknown: 0,
  };

  allIssues.forEach((issue) => {
    const match = issue.message.match(/^(\S+(?:-\S+)*) pattern/);
    if (match) {
      const type = match[1] as PatternType;
      patternsByType[type] = (patternsByType[type] || 0) + 1;
    }
  });

  // Get top duplicates
  const topDuplicates = allIssues
    .slice(0, 10)
    .map((issue) => {
      const similarityMatch = issue.message.match(/(\d+)% similar/);
      const tokenMatch = issue.message.match(/\((\d+) tokens/);
      const typeMatch = issue.message.match(/^(\S+(?:-\S+)*) pattern/);
      const fileMatch = issue.message.match(/similar to (.+?) \(/);

      return {
        file1: issue.location.file,
        file2: fileMatch?.[1] || 'unknown',
        line1: issue.location.line,
        line2: 0, // Not available from Issue
        endLine1: 0, // Not available from Issue
        endLine2: 0, // Not available from Issue
        similarity: similarityMatch
          ? parseInt(similarityMatch[1]) / 100
          : 0,
        patternType: (typeMatch?.[1] as PatternType) || 'unknown',
        tokenCost: tokenMatch ? parseInt(tokenMatch[1]) : 0,
      };
    });

  return {
    totalPatterns: allIssues.length,
    totalTokenCost,
    patternsByType,
    topDuplicates,
  };
}

export { detectDuplicatePatterns } from './detector';
export type { DuplicatePattern, PatternType } from './detector';
