import { scanFiles, readFileContent, ToolRegistry } from '@aiready/core';
import {
  buildDependencyGraph,
  calculateImportDepth,
  getTransitiveDependencies,
  calculateContextBudget,
  detectCircularDependencies,
  calculateCohesion,
  detectModuleClusters,
  classifyFile,
  adjustCohesionForClassification,
  adjustFragmentationForClassification,
  getClassificationRecommendations,
  analyzeIssues,
} from './analyzer';
import { calculateContextScore } from './scoring';
import { getSmartDefaults } from './defaults';
import { generateSummary } from './summary';
import { ContextAnalyzerProvider } from './provider';
import type {
  ContextAnalyzerOptions,
  ContextAnalysisResult,
  ContextSummary,
} from './types';

// Register with global registry
ToolRegistry.register(ContextAnalyzerProvider);

export * from './analyzer';
export * from './scoring';
export * from './defaults';
export * from './summary';
export * from './types';
export * from './semantic-analysis';
export { ContextAnalyzerProvider };

/**
 * Analyze AI context window cost for a codebase
 */
export async function analyzeContext(
  options: ContextAnalyzerOptions
): Promise<ContextAnalysisResult[]> {
  const {
    maxDepth = 5,
    maxContextBudget = 10000,
    minCohesion = 0.6,
    maxFragmentation = 0.5,
    focus = 'all',
    includeNodeModules = false,
    ...scanOptions
  } = options;

  const files = await scanFiles({
    ...scanOptions,
    exclude:
      includeNodeModules && scanOptions.exclude
        ? scanOptions.exclude.filter(
            (pattern) => pattern !== '**/node_modules/**'
          )
        : scanOptions.exclude,
  });

  const pythonFiles = files.filter((f) => f.toLowerCase().endsWith('.py'));
  const fileContents = await Promise.all(
    files.map(async (file) => ({
      file,
      content: await readFileContent(file),
    }))
  );

  const graph = buildDependencyGraph(
    fileContents.filter((f) => !f.file.toLowerCase().endsWith('.py'))
  );

  let pythonResults: ContextAnalysisResult[] = [];
  if (pythonFiles.length > 0) {
    const { analyzePythonContext } = await import('./analyzers/python-context');
    const pythonMetrics = await analyzePythonContext(
      pythonFiles,
      scanOptions.rootDir || options.rootDir || '.'
    );

    pythonResults = pythonMetrics.map((metric) => {
      const { severity, issues, recommendations, potentialSavings } =
        analyzeIssues({
          file: metric.file,
          importDepth: metric.importDepth,
          contextBudget: metric.contextBudget,
          cohesionScore: metric.cohesion,
          fragmentationScore: 0,
          maxDepth,
          maxContextBudget,
          minCohesion,
          maxFragmentation,
          circularDeps: metric.metrics.circularDependencies.map((cycle) =>
            cycle.split(' → ')
          ),
        });

      return {
        file: metric.file,
        tokenCost: Math.floor(
          metric.contextBudget / (1 + metric.imports.length || 1)
        ),
        linesOfCode: metric.metrics.linesOfCode,
        importDepth: metric.importDepth,
        dependencyCount: metric.imports.length,
        dependencyList: metric.imports.map(
          (imp) => imp.resolvedPath || imp.source
        ),
        circularDeps: metric.metrics.circularDependencies.map((cycle) =>
          cycle.split(' → ')
        ),
        cohesionScore: metric.cohesion,
        domains: ['python'],
        exportCount: metric.exports.length,
        contextBudget: metric.contextBudget,
        fragmentationScore: 0,
        relatedFiles: [],
        fileClassification: 'unknown' as const,
        severity,
        issues,
        recommendations,
        potentialSavings,
      };
    });
  }

  const circularDeps = detectCircularDependencies(graph);
  const useLogScale = files.length >= 500;
  const clusters = detectModuleClusters(graph, { useLogScale });
  const fragmentationMap = new Map<string, number>();
  for (const cluster of clusters) {
    for (const file of cluster.files) {
      fragmentationMap.set(file, cluster.fragmentationScore);
    }
  }

  const results: ContextAnalysisResult[] = [];

  for (const { file } of fileContents) {
    const node = graph.nodes.get(file);
    if (!node) continue;

    const importDepth =
      focus === 'depth' || focus === 'all'
        ? calculateImportDepth(file, graph)
        : 0;
    const dependencyList =
      focus === 'depth' || focus === 'all'
        ? getTransitiveDependencies(file, graph)
        : [];
    const contextBudget =
      focus === 'all' ? calculateContextBudget(file, graph) : node.tokenCost;
    const cohesionScore =
      focus === 'cohesion' || focus === 'all'
        ? calculateCohesion(node.exports, file, {
            coUsageMatrix: graph.coUsageMatrix,
          })
        : 1;

    const fragmentationScore = fragmentationMap.get(file) || 0;
    const relatedFiles: string[] = [];
    for (const cluster of clusters) {
      if (cluster.files.includes(file)) {
        relatedFiles.push(...cluster.files.filter((f) => f !== file));
        break;
      }
    }

    const { issues } = analyzeIssues({
      file,
      importDepth,
      contextBudget,
      cohesionScore,
      fragmentationScore,
      maxDepth,
      maxContextBudget,
      minCohesion,
      maxFragmentation,
      circularDeps,
    });

    const domains = [
      ...new Set(node.exports.map((e) => e.inferredDomain || 'unknown')),
    ];
    const fileClassification = classifyFile(node);
    const adjustedCohesionScore = adjustCohesionForClassification(
      cohesionScore,
      fileClassification,
      node
    );
    const adjustedFragmentationScore = adjustFragmentationForClassification(
      fragmentationScore,
      fileClassification
    );
    const classificationRecommendations = getClassificationRecommendations(
      fileClassification,
      file,
      issues
    );

    const {
      severity: adjustedSeverity,
      issues: adjustedIssues,
      recommendations: finalRecommendations,
      potentialSavings: adjustedSavings,
    } = analyzeIssues({
      file,
      importDepth,
      contextBudget,
      cohesionScore: adjustedCohesionScore,
      fragmentationScore: adjustedFragmentationScore,
      maxDepth,
      maxContextBudget,
      minCohesion,
      maxFragmentation,
      circularDeps,
    });

    results.push({
      file,
      tokenCost: node.tokenCost,
      linesOfCode: node.linesOfCode,
      importDepth,
      dependencyCount: dependencyList.length,
      dependencyList,
      circularDeps: circularDeps.filter((cycle) => cycle.includes(file)),
      cohesionScore: adjustedCohesionScore,
      domains,
      exportCount: node.exports.length,
      contextBudget,
      fragmentationScore: adjustedFragmentationScore,
      relatedFiles,
      fileClassification,
      severity: adjustedSeverity,
      issues: adjustedIssues,
      recommendations: [
        ...finalRecommendations,
        ...classificationRecommendations.slice(0, 1),
      ],
      potentialSavings: adjustedSavings,
    });
  }

  const allResults = [...results, ...pythonResults];
  return allResults.sort((a, b) => {
    const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.contextBudget - a.contextBudget;
  });
}
