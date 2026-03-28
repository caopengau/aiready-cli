import { estimateTokens, parseFileExports, FileContent } from '@aiready/core';
import { singularize } from './utils/string-utils';
import {
  calculateImportDepthFromEdges,
  detectGraphCycles,
  getTransitiveDependenciesFromEdges,
} from './utils/dependency-graph-utils';
import type { DependencyGraph, DependencyNode } from './types';
import { buildCoUsageMatrix } from './semantic/co-usage';
import { buildTypeGraph } from './semantic/type-graph';
import { inferDomainFromSemantics } from './semantic/domain-inference';
import { extractExportsWithAST } from './ast-utils';
import { join, dirname, normalize } from 'path';

/**
 * Resolve an import source to its absolute path considering the importing file's location
 */
function resolveImport(
  source: string,
  importingFile: string,
  allFiles: Set<string>
): string | null {
  // If it's not a relative import, we treat it as an external dependency for now
  // (unless it's an absolute path that exists in our set)
  if (!source.startsWith('.') && !source.startsWith('/')) {
    // Handle monorepo package imports (@aiready/*)
    if (source.startsWith('@aiready/')) {
      const pkgName = source.split('/')[1];
      const possiblePaths = [
        // Standard src/index.ts entry point for our packages
        join('packages', pkgName, 'src', 'index.ts'),
        join('packages', pkgName, 'src', 'index.tsx'),
        // Support for sub-exports if needed (e.g. @aiready/core/client)
        join(
          'packages',
          pkgName,
          'src',
          `${source.split('/').slice(2).join('/') || 'index'}.ts`
        ),
      ];

      for (const p of possiblePaths) {
        // Find the absolute path that ends with this relative path
        const absolutePkgPath = Array.from(allFiles).find((f) =>
          f.endsWith(normalize(p))
        );
        if (absolutePkgPath) return absolutePkgPath;
      }
    }

    if (allFiles.has(source)) return source;
    return null;
  }

  const dir = dirname(importingFile);
  const absolutePath = normalize(join(dir, source));

  // Try exact match
  if (allFiles.has(absolutePath)) return absolutePath;

  // Try common extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const ext of extensions) {
    const withExt = absolutePath + ext;
    if (allFiles.has(withExt)) return withExt;
  }

  // Try directory index
  for (const ext of extensions) {
    const indexFile = normalize(join(absolutePath, `index${ext}`));
    if (allFiles.has(indexFile)) return indexFile;
  }

  return null;
}

/**
 * Auto-detect domain keywords from workspace folder structure.
 *
 * @param files - Array of file contents to analyze for folder patterns.
 * @returns Array of singularized domain keywords.
 */
export function extractDomainKeywordsFromPaths(files: FileContent[]): string[] {
  const folderNames = new Set<string>();

  for (const { file } of files) {
    const segments = file.split('/');
    const skipFolders = new Set([
      'src',
      'lib',
      'dist',
      'build',
      'node_modules',
      'test',
      'tests',
      '__tests__',
      'spec',
      'e2e',
      'scripts',
      'components',
      'utils',
      'helpers',
      'util',
      'helper',
      'api',
      'apis',
    ]);

    for (const segment of segments) {
      const normalized = segment.toLowerCase();
      if (
        normalized &&
        !skipFolders.has(normalized) &&
        !normalized.includes('.')
      ) {
        folderNames.add(singularize(normalized));
      }
    }
  }

  return Array.from(folderNames);
}

/**
 * Build a dependency graph from file contents, resolving imports and extracting metadata.
 *
 * @param files - Array of file contents to process.
 * @param options - Optional configuration for domain detection.
 * @returns Complete dependency graph with nodes, edges, and semantic matrices.
 */
export async function buildDependencyGraph(
  files: FileContent[],
  options?: { domainKeywords?: string[] }
): Promise<DependencyGraph> {
  const nodes = new Map<string, DependencyNode>();
  const edges = new Map<string, Set<string>>();

  const autoDetectedKeywords =
    options?.domainKeywords ?? extractDomainKeywordsFromPaths(files);

  const allFilePaths = new Set(files.map((f) => f.file));

  for (const { file, content } of files) {
    // 1. Get high-fidelity AST-based imports & exports
    const { imports: astImports } = await parseFileExports(content, file);

    // 2. Resolve imports to absolute paths in the graph
    const resolvedImports = astImports
      .map((i) => resolveImport(i.source, file, allFilePaths))
      .filter((path): path is string => path !== null);

    const importSources = astImports.map((i) => i.source);

    // 3. Wrap with platform-specific metadata (v0.11+)
    const exports = await extractExportsWithAST(
      content,
      file,
      { domainKeywords: autoDetectedKeywords },
      importSources
    );

    const tokenCost = estimateTokens(content);
    const linesOfCode = content.split('\n').length;

    nodes.set(file, {
      file,
      imports: importSources,
      exports,
      tokenCost,
      linesOfCode,
    });
    edges.set(file, new Set(resolvedImports));
  }

  const graph: DependencyGraph = { nodes, edges };
  const coUsageMatrix = buildCoUsageMatrix(graph);
  const typeGraph = buildTypeGraph(graph);

  graph.coUsageMatrix = coUsageMatrix;
  graph.typeGraph = typeGraph;

  for (const [file, node] of nodes) {
    for (const exp of node.exports) {
      const semanticAssignments = inferDomainFromSemantics(
        file,
        exp.name,
        graph,
        coUsageMatrix,
        typeGraph,
        exp.typeReferences
      );
      const expAny = exp as {
        inferredDomain?: string;
        domains?: Array<{ domain: string }>;
      };
      expAny.domains = semanticAssignments;
      if (semanticAssignments.length > 0) {
        expAny.inferredDomain = semanticAssignments[0].domain;
      }
    }
  }

  return graph;
}

/**
 * Calculate the maximum depth of the import tree for a specific file.
 *
 * @param file - File path to start depth calculation from.
 * @param graph - The dependency graph.
 * @param visited - Optional set to track visited nodes during traversal.
 * @param depth - Current recursion depth.
 * @returns Maximum depth of the import chain.
 */
export function calculateImportDepth(
  file: string,
  graph: DependencyGraph,
  visited = new Set<string>(),
  depth = 0
): number {
  return calculateImportDepthFromEdges(file, graph.edges, visited, depth);
}

/**
 * Retrieve all transitive dependencies for a specific file.
 *
 * @param file - File path to analyze.
 * @param graph - The dependency graph.
 * @param visited - Optional set to track visited nodes.
 * @returns Array of all reachable file paths.
 */
export function getTransitiveDependencies(
  file: string,
  graph: DependencyGraph,
  visited = new Set<string>()
): string[] {
  return getTransitiveDependenciesFromEdges(file, graph.edges, visited);
}

/**
 * Calculate total context budget (tokens needed to understand this file and its dependencies).
 *
 * @param file - File path to calculate budget for.
 * @param graph - The dependency graph.
 * @returns Total token count including recursive dependencies.
 */
export function calculateContextBudget(
  file: string,
  graph: DependencyGraph
): number {
  const node = graph.nodes.get(file);
  if (!node) return 0;

  let totalTokens = node.tokenCost;
  const deps = getTransitiveDependencies(file, graph);

  for (const dep of deps) {
    const depNode = graph.nodes.get(dep);
    if (depNode) {
      totalTokens += depNode.tokenCost;
    }
  }

  return totalTokens;
}

/**
 * Detect circular dependencies (cycles) within the dependency graph.
 *
 * @param graph - The dependency graph to scan.
 * @returns Array of dependency cycles (each cycle is an array of file paths).
 */
export function detectCircularDependencies(graph: DependencyGraph): string[][] {
  return detectGraphCycles(graph.edges);
}
