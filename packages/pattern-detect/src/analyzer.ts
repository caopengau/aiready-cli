import { scanFiles, readFileContent, Severity, IssueType } from '@aiready/core';
import type { AnalysisResult, Issue, ScanOptions } from '@aiready/core';
import {
  detectDuplicatePatterns,
  type PatternType,
  type DuplicatePattern,
} from './detector';
import {
  groupDuplicatesByFilePair,
  createRefactorClusters,
  filterClustersByImpact,
  type DuplicateGroup,
  type RefactorCluster,
} from './grouping';

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
  excludePatterns?: string[]; // Regex patterns to exclude specific code content
  confidenceThreshold?: number; // 0-1, minimum confidence score for reporting
  ignoreWhitelist?: string[]; // List of file pairs or patterns to ignore (false-positive whitelist)
  onProgress?: (processed: number, total: number, message: string) => void;
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
 * Generate refactoring suggestion based on pattern type.
 *
 * @param patternType - The detected pattern type.
 * @param similarity - Similarity score (0-1).
 * @returns Human-readable refactoring advice.
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
 * Determine smart defaults based on repository size estimation.
 *
 * @param directory - The directory to analyze for size.
 * @param userOptions - User-provided option overrides.
 * @returns Promise resolving to optimal detection options.
 */
export async function getSmartDefaults(
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
  const scanOptions = {
    rootDir: directory,
    include: userOptions.include || ['**/*.{ts,tsx,js,jsx,py,java}'],
    exclude: userOptions.exclude,
  };

  const files = await scanFiles(scanOptions);
  const fileCount = files.length;
  const estimatedBlocks = fileCount * 5;

  const minLines = Math.max(
    6,
    Math.min(20, 6 + Math.floor(estimatedBlocks / 1000) * 2)
  );

  // Adjusted formula to be less aggressive - start at 0.45 and increase more slowly
  const minSimilarity = Math.min(0.75, 0.45 + (estimatedBlocks / 10000) * 0.3);
  const batchSize = estimatedBlocks > 1000 ? 200 : 100;
  const severity = estimatedBlocks > 3000 ? 'high' : 'all';
  const maxCandidatesPerBlock = Math.max(
    5,
    Math.min(100, Math.floor(1000000 / estimatedBlocks))
  );

  const defaults: PatternDetectOptions = {
    rootDir: directory,
    minSimilarity,
    minLines,
    batchSize,
    approx: true,
    minSharedTokens: 10,
    maxCandidatesPerBlock,
    streamResults: false,
    severity,
    includeTests: false,
  };

  const result: PatternDetectOptions = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (
      key in userOptions &&
      userOptions[key as keyof PatternDetectOptions] !== undefined
    ) {
      (result as Record<string, unknown>)[key] =
        userOptions[key as keyof PatternDetectOptions];
    }
  }

  return result;
}

/**
 * Log current configuration settings to the console.
 *
 * @param config - The active detection configuration.
 * @param estimatedBlocks - Estimated number of code blocks to scan.
 */
function logConfiguration(
  config: PatternDetectOptions,
  estimatedBlocks: number
): void {
  if ((config as { suppressToolConfig?: boolean }).suppressToolConfig) return;
  console.log('📋 Configuration:');
  console.log(`   Repository size: ~${estimatedBlocks} code blocks`);
  console.log(`   Similarity threshold: ${config.minSimilarity}`);
  console.log(`   Minimum lines: ${config.minLines}`);
  console.log(`   Approximate mode: ${config.approx ? 'enabled' : 'disabled'}`);
  console.log(`   Max candidates per block: ${config.maxCandidatesPerBlock}`);
  console.log(`   Min shared tokens: ${config.minSharedTokens}`);
  console.log(`   Severity filter: ${config.severity}`);
  console.log(`   Include tests: ${config.includeTests}`);

  if (config.excludePatterns && config.excludePatterns.length > 0) {
    console.log(`   Exclude patterns: ${config.excludePatterns.length} active`);
  }
  if (config.confidenceThreshold && config.confidenceThreshold > 0) {
    console.log(`   Confidence threshold: ${config.confidenceThreshold}`);
  }
  if (config.ignoreWhitelist && config.ignoreWhitelist.length > 0) {
    console.log(
      `   Ignore whitelist: ${config.ignoreWhitelist.length} entries`
    );
  }

  console.log('');
}

/**
 * Main entry point for pattern detection analysis.
 *
 * @param options - Configuration including rootDir and detection parameters.
 * @returns Promise resolving to the comprehensive pattern detect report.
 * @lastUpdated 2026-03-18
 */
export async function analyzePatterns(options: PatternDetectOptions): Promise<{
  results: AnalysisResult[];
  duplicates: DuplicatePattern[];
  files: string[];
  groups?: DuplicateGroup[];
  clusters?: RefactorCluster[];
  config: PatternDetectOptions;
}> {
  const smartDefaults = await getSmartDefaults(options.rootDir || '.', options);
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
    groupByFilePair = true,
    createClusters = true,
    minClusterTokenCost = 1000,
    minClusterFiles = 3,
    excludePatterns = [],
    confidenceThreshold = 0,
    ignoreWhitelist = [],
    ...scanOptions
  } = finalOptions;

  const files = await scanFiles(scanOptions);
  const estimatedBlocks = files.length * 3;
  logConfiguration(finalOptions, estimatedBlocks);

  const results: AnalysisResult[] = [];
  const READ_BATCH_SIZE = 50;
  const fileContents: { file: string; content: string }[] = [];

  for (let i = 0; i < files.length; i += READ_BATCH_SIZE) {
    const batch = files.slice(i, i + READ_BATCH_SIZE);
    const batchContents = await Promise.all(
      batch.map(async (file) => ({
        file,
        content: await readFileContent(file),
      }))
    );
    fileContents.push(...batchContents);
  }

  const duplicates = await detectDuplicatePatterns(fileContents, {
    minSimilarity,
    minLines,
    batchSize,
    approx,
    minSharedTokens,
    maxCandidatesPerBlock,
    streamResults,
    excludePatterns,
    confidenceThreshold,
    ignoreWhitelist,
    onProgress: options.onProgress,
  });

  for (const file of files) {
    const fileDuplicates = duplicates.filter(
      (dup) => dup.file1 === file || dup.file2 === file
    );

    const issues: Issue[] = fileDuplicates.map((dup) => {
      const otherFile = dup.file1 === file ? dup.file2 : dup.file1;
      const severity: Severity =
        dup.similarity > 0.95
          ? Severity.Critical
          : dup.similarity > 0.9
            ? Severity.Major
            : Severity.Minor;

      return {
        type: IssueType.DuplicatePattern,
        severity,
        message: `${dup.patternType} pattern ${Math.round(dup.similarity * 100)}% similar to ${otherFile} (${dup.tokenCost} tokens wasted)`,
        location: {
          file,
          line: dup.file1 === file ? dup.line1 : dup.line2,
        },
        suggestion: getRefactoringSuggestion(dup.patternType, dup.similarity),
      };
    });

    let filteredIssues = issues;
    if (severity !== 'all') {
      const severityMap = {
        critical: [Severity.Critical],
        high: [Severity.Critical, Severity.Major],
        medium: [Severity.Critical, Severity.Major, Severity.Minor],
      };
      const allowedSeverities = severityMap[
        severity as keyof typeof severityMap
      ] || [Severity.Critical, Severity.Major, Severity.Minor];
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
  }

  return { results, duplicates, files, groups, clusters, config: finalOptions };
}

/**
 * Generate a summary of pattern detection results.
 *
 * @param results - Array of file-level analysis results.
 * @returns Consolidated pattern summary object.
 */
export function generateSummary(results: AnalysisResult[]): PatternSummary {
  const allIssues = results.flatMap((r) => r.issues || []);
  const totalTokenCost = results.reduce(
    (sum, r) => sum + (r.metrics?.tokenCost || 0),
    0
  );

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
          endLine: 0,
        },
        {
          path: fileMatch?.[1] || 'unknown',
          startLine: 0,
          endLine: 0,
        },
      ],
      similarity: similarityMatch ? parseInt(similarityMatch[1]) / 100 : 0,
      confidence: similarityMatch ? parseInt(similarityMatch[1]) / 100 : 0, // Fallback for summary
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
