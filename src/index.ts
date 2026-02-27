import { scanFiles, readFileContent } from '@aiready/core';
import type { AnalysisResult, Issue, ScanOptions } from '@aiready/core';
import {
  detectDuplicatePatterns,
  type PatternType,
  type DuplicatePattern,
} from './detector';
import type { Severity } from './context-rules';
import {
  groupDuplicatesByFilePair,
  createRefactorClusters,
  filterClustersByImpact,
  type DuplicateGroup,
  type RefactorCluster,
} from './grouping';
import { calculatePatternScore } from './scoring';

export type {
  PatternType,
  DuplicatePattern,
  Severity,
  DuplicateGroup,
  RefactorCluster,
};
export { calculatePatternScore };

export interface PatternDetectOptions extends ScanOptions {
  minSimilarity?: number; // 0-1, default 0.40 (Jaccard similarity)
  minLines?: number; // Minimum lines to consider, default 5
  batchSize?: number; // Batch size for comparisons, default 100
  approx?: boolean; // Use approximate candidate selection (default true)
  minSharedTokens?: number; // Minimum shared tokens to consider a candidate, default 8
  maxCandidatesPerBlock?: number; // Cap candidates per block, default 100
  streamResults?: boolean; // Output duplicates incrementally as found (default false)
  severity?: string; // Filter by severity: critical|high|medium|all (default: all)
  includeTests?: boolean; // Include test files in analysis (default: false)
  useSmartDefaults?: boolean; // Use smart defaults based on repo size (default: true)
  groupByFilePair?: boolean; // Group duplicates by file pair to reduce noise (default: true)
  createClusters?: boolean; // Create refactor clusters for related patterns (default: true)
  minClusterTokenCost?: number; // Minimum token cost for cluster reporting (default: 1000)
  minClusterFiles?: number; // Minimum files for cluster reporting (default: 3)
}

export interface PatternSummary {
  totalPatterns: number;
  totalTokenCost: number;
  patternsByType: Record<PatternType, number>;
  topDuplicates: Array<{
    files: Array<{
      path: string;
      startLine: number;
      endLine: number;
    }>;
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

/**
 * Determine smart defaults based on repository size estimation
 */
async function getSmartDefaults(
  directory: string,
  userOptions: Partial<PatternDetectOptions>
): Promise<PatternDetectOptions> {
  // If user explicitly disabled smart defaults, return conservative defaults
  if (userOptions.useSmartDefaults === false) {
    return {
      rootDir: directory,
      minSimilarity: 0.6,
      minLines: 8,
      batchSize: 100,
      approx: true,
      minSharedTokens: 12,
      maxCandidatesPerBlock: 5,
      streamResults: false,
      severity: 'all',
      includeTests: false,
    };
  }

  // Quick size estimation by scanning files first
  // Note: scanFiles automatically merges with DEFAULT_EXCLUDE, so we only
  // need to pass user-provided excludes
  const scanOptions = {
    rootDir: directory,
    include: userOptions.include || ['**/*.{ts,tsx,js,jsx,py,java}'],
    exclude: userOptions.exclude,
  };

  // Estimate size by doing a quick file scan and counting potential blocks
  const { scanFiles } = await import('@aiready/core');
  const files = await scanFiles(scanOptions);
  const estimatedBlocks = files.length * 3; // Rough estimate: ~3 blocks per file

  // Reverse computation: calculate optimal parameters to target ~30 second completion
  // Based on empirical performance: ~100,000 block-candidate comparisons per second

  // maxCandidatesPerBlock: scale inversely with repo size to maintain ~30s target
  const maxCandidatesPerBlock = Math.max(
    3,
    Math.min(10, Math.floor(30000 / estimatedBlocks))
  );

  // minSimilarity: increase with repo size to reduce noise in large repos
  const minSimilarity = Math.min(0.75, 0.5 + (estimatedBlocks / 10000) * 0.25);

  // minLines: increase with repo size to focus on substantial duplications
  const minLines = Math.max(
    6,
    Math.min(12, 6 + Math.floor(estimatedBlocks / 2000))
  );

  // minSharedTokens: increase with repo size for better pre-filtering
  const minSharedTokens = Math.max(
    10,
    Math.min(20, 10 + Math.floor(estimatedBlocks / 2000))
  );

  // batchSize: larger for better I/O efficiency in bigger repos
  const batchSize = estimatedBlocks > 1000 ? 200 : 100;

  // severity: focus on high-impact issues in very large repos
  const severity = estimatedBlocks > 5000 ? 'high' : 'all';

  const defaults: PatternDetectOptions = {
    rootDir: directory,
    minSimilarity,
    minLines,
    batchSize,
    approx: true,
    minSharedTokens,
    maxCandidatesPerBlock,
    streamResults: false,
    severity,
    includeTests: false,
  };

  // Only apply smart defaults for options that aren't already set
  const result: PatternDetectOptions = { ...defaults };
  for (const [key, value] of Object.entries(defaults)) {
    if (
      key in userOptions &&
      userOptions[key as keyof PatternDetectOptions] !== undefined
    ) {
      (result as any)[key] = userOptions[key as keyof PatternDetectOptions];
    }
  }

  return result;
}

/**
 * Log current configuration settings
 */
function logConfiguration(
  config: PatternDetectOptions,
  estimatedBlocks: number
): void {
  // Allow callers to suppress verbose tool-level configuration logging
  if ((config as any).suppressToolConfig) return;
  console.log('📋 Configuration:');
  console.log(`   Repository size: ~${estimatedBlocks} code blocks`);
  console.log(`   Similarity threshold: ${config.minSimilarity}`);
  console.log(`   Minimum lines: ${config.minLines}`);
  console.log(`   Approximate mode: ${config.approx ? 'enabled' : 'disabled'}`);
  console.log(`   Max candidates per block: ${config.maxCandidatesPerBlock}`);
  console.log(`   Min shared tokens: ${config.minSharedTokens}`);
  console.log(`   Severity filter: ${config.severity}`);
  console.log(`   Include tests: ${config.includeTests}`);
  console.log('');
}

export async function analyzePatterns(options: PatternDetectOptions): Promise<{
  results: AnalysisResult[];
  duplicates: DuplicatePattern[];
  files: string[];
  groups?: DuplicateGroup[];
  clusters?: RefactorCluster[];
}> {
  // Apply smart defaults based on repository size for unset options
  const smartDefaults = await getSmartDefaults(options.rootDir || '.', options);

  // Merge options with smart defaults (options take precedence, smart defaults fill in gaps)
  const finalOptions = { ...smartDefaults, ...options };

  const {
    minSimilarity = 0.4,
    minLines = 5,
    batchSize = 100,
    approx = true,
    minSharedTokens = 8,
    maxCandidatesPerBlock = 100,
    streamResults = false,
    severity = 'all',
    includeTests = false,
    groupByFilePair = true,
    createClusters = true,
    minClusterTokenCost = 1000,
    minClusterFiles = 3,
    ...scanOptions
  } = finalOptions;

  const { scanFiles } = await import('@aiready/core');
  const files = await scanFiles(scanOptions);

  // Estimate blocks for logging
  const estimatedBlocks = files.length * 3;
  logConfiguration(finalOptions, estimatedBlocks);

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
    batchSize,
    approx,
    minSharedTokens,
    maxCandidatesPerBlock,
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

    // Filter issues by severity if specified
    let filteredIssues = issues;
    if (severity !== 'all') {
      const severityMap = {
        critical: ['critical'],
        high: ['critical', 'major'],
        medium: ['critical', 'major', 'minor'],
      };
      const allowedSeverities = severityMap[
        severity as keyof typeof severityMap
      ] || ['critical', 'major', 'minor'];
      filteredIssues = issues.filter((issue) =>
        allowedSeverities.includes(issue.severity)
      );
    }

    const totalTokenCost = fileDuplicates.reduce(
      (sum, dup) => sum + dup.tokenCost,
      0
    );

    results.push({
      fileName: file,
      issues: filteredIssues,
      metrics: {
        tokenCost: totalTokenCost,
        consistencyScore: Math.max(0, 1 - fileDuplicates.length * 0.1),
      },
    });
  }

  // NEW: Create groups and clusters if requested
  let groups: DuplicateGroup[] | undefined;
  let clusters: RefactorCluster[] | undefined;

  if (groupByFilePair) {
    groups = groupDuplicatesByFilePair(duplicates);
  }

  if (createClusters) {
    const allClusters = createRefactorClusters(duplicates);
    clusters = filterClustersByImpact(
      allClusters,
      minClusterTokenCost,
      minClusterFiles
    );
    // Note: cluster filtering info is returned via clusters; do not log here.
  }

  return { results, duplicates, files, groups, clusters };
}

/**
 * Generate a summary of pattern analysis
 */
export function generateSummary(results: AnalysisResult[]): PatternSummary {
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
  const topDuplicates = allIssues.slice(0, 10).map((issue) => {
    const similarityMatch = issue.message.match(/(\d+)% similar/);
    const tokenMatch = issue.message.match(/\((\d+) tokens/);
    const typeMatch = issue.message.match(/^(\S+(?:-\S+)*) pattern/);
    const fileMatch = issue.message.match(/similar to (.+?) \(/);

    return {
      files: [
        {
          path: issue.location.file,
          startLine: issue.location.line,
          endLine: 0, // Not available from Issue
        },
        {
          path: fileMatch?.[1] || 'unknown',
          startLine: 0, // Not available from Issue
          endLine: 0, // Not available from Issue
        },
      ],
      similarity: similarityMatch ? parseInt(similarityMatch[1]) / 100 : 0,
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
export {
  getSeverityLabel,
  filterBySeverity,
  calculateSeverity,
} from './context-rules';
export { getSmartDefaults };
