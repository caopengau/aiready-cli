import type { ScanOptions, Severity, ExportInfo } from '@aiready/core';
export type { ExportInfo };

/**
 * Options for the Context Analyzer tool.
 * Controls thresholds for import depth, context budget, and cohesion.
 */
export interface ContextAnalyzerOptions extends ScanOptions {
  /** Maximum acceptable import depth (default: 5) */
  maxDepth?: number;
  /** Maximum acceptable token budget for a single context (default: 25000) */
  maxContextBudget?: number;
  /** Minimum acceptable cohesion score between 0 and 1 (default: 0.6) */
  minCohesion?: number;
  /** Maximum acceptable fragmentation score between 0 and 1 (default: 0.5) */
  maxFragmentation?: number;
  /** Analysis focus area: fragmentation, cohesion, depth, or all (default: 'all') */
  focus?: 'fragmentation' | 'cohesion' | 'depth' | 'all';
  /** Whether to include node_modules in the analysis (default: false) */
  includeNodeModules?: boolean;
}

/**
 * The result of a context analysis for a single file or module.
 * Includes metrics for tokens, dependencies, cohesion, and AI impact.
 */
export interface ContextAnalysisResult {
  /** The file path being analyzed */
  file: string;

  // Basic metrics
  /** Total number of tokens in this file */
  tokenCost: number;
  /** Total lines of code in the file */
  linesOfCode: number;

  // Dependency analysis
  /** Maximum depth of the import tree for this file */
  importDepth: number;
  /** Total number of transitive dependencies */
  dependencyCount: number;
  /** List of all files in the dependency tree */
  dependencyList: string[];
  /** Detected circular dependency chains */
  circularDeps: string[][];

  // Cohesion analysis
  /** Cohesion score from 0 to 1 (1 is perfect cohesion) */
  cohesionScore: number;
  /** Detected domain categories for the module */
  domains: string[];
  /** Number of exported symbols */
  exportCount: number;

  // AI context impact
  /** Total tokens required to understand this file and all its dependencies */
  contextBudget: number;
  /** Fragmentation score from 0 to 1 (0 is well-grouped) */
  fragmentationScore: number;
  /** List of files that should be loaded together for full context */
  relatedFiles: string[];

  // File classification (NEW)
  /** The semantic classification of the file (e.g. 'barrel-export', 'service-file') */
  fileClassification: FileClassification;

  // Recommendations
  /** Overall severity of identified issues */
  severity: Severity | 'critical' | 'major' | 'minor' | 'info';
  /** List of specific structural problems found */
  issues: string[];
  /** Actionable suggestions for improving context readiness */
  recommendations: string[];
  /** Estimated tokens that could be saved by following recommendations */
  potentialSavings: number;
}

/**
 * Classification of file type for analysis context
 * Helps distinguish real issues from false positives
 */
export type FileClassification =
  | 'barrel-export' // Re-exports from other modules (index.ts files)
  | 'boilerplate-barrel' // Redundant barrel file with no added value (architectural theater)
  | 'type-definition' // Primarily type/interface definitions
  | 'cohesive-module' // Single domain, high cohesion (acceptable large files)
  | 'utility-module' // Utility/helper files with cohesive purpose despite multi-domain
  | 'service-file' // Service files orchestrating multiple dependencies
  | 'lambda-handler' // Lambda/API handlers with single business purpose
  | 'email-template' // Email templates/layouts with structural cohesion
  | 'parser-file' // Parser/transformer files with single transformation purpose
  | 'nextjs-page' // Next.js App Router page with SEO/structured data exports
  | 'spoke-module' // Intentional monorepo spoke package file
  | 'mixed-concerns' // Multiple domains, potential refactoring candidate
  | 'unknown'; // Unable to classify

export interface ModuleCluster {
  domain: string; // e.g., "user-management", "auth"
  files: string[];
  totalTokens: number;
  fragmentationScore: number; // 0-1, higher = more scattered
  pathEntropy?: number; // normalized [0-1] Shannon entropy of directory distribution
  directoryDistance?: number; // normalized [0-1] based on common ancestor depth
  importCohesion?: number; // 0-1 average pairwise Jaccard similarity of imports
  avgCohesion: number; // Average cohesion across files in cluster
  suggestedStructure: {
    targetFiles: number; // Recommended number of files
    consolidationPlan: string[]; // Step-by-step suggestions
  };
}

export interface ContextSummary {
  totalFiles: number;
  totalTokens: number;
  avgContextBudget: number;
  maxContextBudget: number;

  // Depth metrics
  avgImportDepth: number;
  maxImportDepth: number;
  deepFiles: Array<{ file: string; depth: number }>; // Files exceeding maxDepth

  // Fragmentation metrics
  avgFragmentation: number;
  fragmentedModules: ModuleCluster[];

  // Cohesion metrics
  avgCohesion: number;
  lowCohesionFiles: Array<{ file: string; score: number }>;

  // Issues summary
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  totalPotentialSavings: number;

  // Top offenders
  topExpensiveFiles: Array<{
    file: string;
    contextBudget: number;
    severity: string;
  }>;
  config?: any;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>; // file -> dependencies
  coUsageMatrix?: Map<string, Map<string, number>>; // file -> file -> co-usage count
  typeGraph?: Map<string, Set<string>>; // type -> files that reference it
}

export interface DependencyNode {
  file: string;
  imports: string[]; // Direct imports
  exports: ExportInfo[];
  tokenCost: number;
  linesOfCode: number;
  exportedBy?: string[]; // Files that import exports from this file
  sharedTypes?: string[]; // Types shared with other files
}

export interface DomainAssignment {
  domain: string;
  confidence: number; // 0-1, how confident are we in this assignment
  signals: DomainSignals; // Which signals contributed to this assignment
}

export interface DomainSignals {
  folderStructure: boolean; // Matched from folder name
  importPath: boolean; // Matched from import paths
  typeReference: boolean; // Matched from TypeScript type usage
  coUsage: boolean; // Matched from co-usage patterns
  exportName: boolean; // Matched from export identifier name
}

export interface CoUsageData {
  file: string;
  coImportedWith: Map<string, number>; // file -> count of times imported together
  sharedImporters: string[]; // files that import both this and another file
}

export interface TypeDependency {
  typeName: string;
  definedIn: string; // file where type is defined
  usedBy: string[]; // files that reference this type
}
