import {
  FileNode,
  GraphEdge,
  GraphData,
  ReportData,
  BusinessMetrics,
} from './types';
import { severityColors, GRAPH_CONFIG } from './constants';

export function getSeverityColor(severity: string | undefined): string {
  if (!severity) return severityColors.default;
  const s = severity.toLowerCase();
  if (s === 'critical') return severityColors.critical;
  if (s === 'major') return severityColors.major;
  if (s === 'minor') return severityColors.minor;
  if (s === 'info') return severityColors.info;
  return severityColors.default;
}

/**
 * Extract business metrics from the scoring breakdown (v0.10+).
 * Mirrors the logic in the VS Code extension's extractBusinessMetrics.
 */
function extractBusinessMetrics(report: ReportData): BusinessMetrics {
  const breakdown = report.scoring?.breakdown;
  if (!breakdown || breakdown.length === 0) return {};

  let totalCost = 0;
  let totalHours = 0;

  for (const tool of breakdown) {
    const m = tool.rawMetrics;
    if (m?.estimatedMonthlyCost) totalCost += m.estimatedMonthlyCost;
    if (m?.estimatedDeveloperHours) totalHours += m.estimatedDeveloperHours;
  }

  // Derive AI acceptance rate from average tool scores
  let aiAcceptanceRate: number | undefined;
  if (breakdown.length >= 2) {
    let rate = 0.65;
    for (const tool of breakdown) {
      rate += (tool.score - 50) * 0.003;
    }
    aiAcceptanceRate = Math.max(0.1, Math.min(0.95, rate));
  }

  return {
    estimatedMonthlyCost: totalCost > 0 ? totalCost : undefined,
    estimatedDeveloperHours: totalHours > 0 ? totalHours : undefined,
    aiAcceptanceRate,
  };
}

export function transformReportToGraph(
  report: any,
  runtimeGraphConfig?: { maxNodes?: number; maxEdges?: number }
): GraphData {
  // Use runtime config if available (from aiready.json), else use defaults from constants
  const graphConfig = {
    maxNodes: runtimeGraphConfig?.maxNodes ?? GRAPH_CONFIG.maxNodes,
    maxEdges: runtimeGraphConfig?.maxEdges ?? GRAPH_CONFIG.maxEdges,
  };

  // Support both legacy and unified report formats
  const patterns = report.patternDetect?.results || report.patterns || [];
  const duplicates = report.patternDetect?.duplicates || report.duplicates || [];
  const context = report.contextAnalyzer?.results || report.context || [];

  const nodes: FileNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, FileNode>();

  const fileIssues = new Map<
    string,
    { count: number; severities: Set<string>; maxSeverity: string }
  >();

  const severityPriority: Record<string, number> = {
    critical: 4,
    major: 3,
    minor: 2,
    info: 1,
    default: 0,
  };

  for (const pattern of patterns) {
    const issueCount = pattern.issues?.length || 0;
    if (issueCount > 0) {
      let maxSeverity = 'info';
      for (const issue of pattern.issues) {
        if (
          (severityPriority[issue.severity] || 0) >
          (severityPriority[maxSeverity] || 0)
        ) {
          maxSeverity = issue.severity;
        }
      }
      fileIssues.set(pattern.fileName, {
        count: issueCount,
        severities: new Set(),
        maxSeverity,
      });
    }
  }

  for (const ctx of context) {
    // Try direct match first. If not found, try basename fallback so that
    // pattern entries with different path styles still associate their
    // severity with the context file in consumer reports.
    let issues = fileIssues.get(ctx.file);
    if (!issues) {
      const ctxBase = (ctx.file || '').split('/').pop();
      for (const [k, v] of fileIssues.entries()) {
        if ((k || '').split('/').pop() === ctxBase) {
          issues = v;
          break;
        }
      }
    }
    const severity = issues?.maxSeverity || ctx.severity || 'default';
    const tokenCost = ctx.tokenCost || 0;

    const titleLines = [
      `Token Cost: ${tokenCost}`,
      `Lines of Code: ${ctx.linesOfCode ?? 'n/a'}`,
      `Dependencies: ${ctx.dependencyCount ?? 0}`,
    ];

    if (issues) {
      titleLines.push(`Issues: ${issues.count}`);
      titleLines.push(`Severity: ${issues.maxSeverity}`);
    }

    if (ctx.issues && ctx.issues.length > 0) {
      titleLines.push('', ...ctx.issues.slice(0, 3));
    }

    const node: FileNode = {
      id: ctx.file,
      label: ctx.file.split('/').pop() || ctx.file,
      value: Math.max(10, Math.sqrt(tokenCost) * 3 + (issues?.count || 0) * 10),
      color: getSeverityColor(severity),
      title: titleLines.join('\n'),
      duplicates: issues?.count,
      tokenCost,
      severity,
    };

    nodes.push(node);
    nodeMap.set(ctx.file, node);
  }

  // Pre-calculate node keys for faster matching
  const nodeKeys = Array.from(nodeMap.keys());

  for (const ctx of context) {
    const sourceDir = ctx.file.substring(0, ctx.file.lastIndexOf('/'));
    for (const dep of ctx.dependencyList || []) {
      if (dep.startsWith('.') || dep.startsWith('/')) {
        // Try multiple matching strategies
        let targetFile: string | undefined;

        // Strategy 1: Direct resolve from source file's directory
        const normalizedDep = dep.replace(/^\.\/?/, '');
        const possiblePaths = [
          // With extensions
          `${sourceDir}/${normalizedDep}.ts`,
          `${sourceDir}/${normalizedDep}.tsx`,
          `${sourceDir}/${normalizedDep}/index.ts`,
          `${sourceDir}/${normalizedDep}/index.tsx`,
          // Just the path
          `${sourceDir}/${normalizedDep}`,
        ];

        for (const p of possiblePaths) {
          if (nodeMap.has(p)) {
            targetFile = p;
            break;
          }
        }

        // Strategy 2: Fall back to loose endsWith matching
        if (!targetFile) {
          const depBase = normalizedDep.split('/').pop() || normalizedDep;
          targetFile = nodeKeys.find(
            (k) =>
              k.endsWith(`/${depBase}.ts`) ||
              k.endsWith(`/${depBase}.tsx`) ||
              k.endsWith(`/${depBase}/index.ts`) ||
              k.endsWith(`/${depBase}/index.tsx`)
          );
        }

        if (targetFile && targetFile !== ctx.file) {
          edges.push({
            source: ctx.file,
            target: targetFile,
            type: 'dependency',
          });
        }
      }
    }

    for (const related of ctx.relatedFiles || []) {
      let relatedId: string | undefined = related;

      // If exact match exists, use it. Otherwise try resolving relative paths
      // from the source file's directory and try common extensions. As a
      // final fallback, match by basename (endsWith) similar to dependency
      // heuristics.
      if (!nodeMap.has(relatedId!)) {
        const sourceDir = ctx.file.substring(0, ctx.file.lastIndexOf('/'));
        const normalizedRel = related.replace(/^\.\/?/, '');
        const tryPaths = [
          `${sourceDir}/${normalizedRel}.ts`,
          `${sourceDir}/${normalizedRel}.tsx`,
          `${sourceDir}/${normalizedRel}/index.ts`,
          `${sourceDir}/${normalizedRel}/index.tsx`,
          `${sourceDir}/${normalizedRel}`,
        ];
        for (const p of tryPaths) {
          if (nodeMap.has(p)) {
            relatedId = p;
            break;
          }
        }
      }

      // Fallback: loose basename matching
      if (!nodeMap.has(relatedId!)) {
        const relBase = (related.split('/').pop() || related).replace(
          /\.(ts|tsx|js|jsx)$/,
          ''
        );
        relatedId = nodeKeys.find(
          (k) =>
            k.endsWith(`/${relBase}.ts`) ||
            k.endsWith(`/${relBase}.tsx`) ||
            k.endsWith(`/${relBase}/index.ts`) ||
            k.endsWith(`/${relBase}/index.tsx`) ||
            k.endsWith(`/${relBase}`)
        );
      }

      if (relatedId && nodeMap.has(relatedId) && relatedId !== ctx.file) {
        const exists = edges.some(
          (e) =>
            (e.source === ctx.file && e.target === relatedId) ||
            (e.source === relatedId && e.target === ctx.file)
        );
        if (!exists)
          edges.push({ source: ctx.file, target: relatedId, type: 'related' });
      }
    }
  }

  for (const dup of duplicates) {
    if (nodeMap.has(dup.file1) && nodeMap.has(dup.file2)) {
      const exists = edges.some(
        (e) =>
          (e.source === dup.file1 && e.target === dup.file2) ||
          (e.source === dup.file2 && e.target === dup.file1)
      );
      if (!exists)
        edges.push({
          source: dup.file1,
          target: dup.file2,
          type: 'similarity',
        });
    }
  }

  // Sort edges by priority: similarity and dependency first (most important for visualization)
  const edgePriority: Record<string, number> = {
    similarity: 1,
    dependency: 2,
    reference: 4,
    related: 3,
  };
  const sortedEdges = [...edges].sort((a, b) => {
    const priorityA = edgePriority[a.type] || 99;
    const priorityB = edgePriority[b.type] || 99;
    return priorityA - priorityB;
  });

  return {
    nodes: nodes.slice(0, graphConfig.maxNodes),
    edges: sortedEdges.slice(0, graphConfig.maxEdges),
    truncated: {
      nodes: nodes.length > graphConfig.maxNodes,
      edges: sortedEdges.length > graphConfig.maxEdges,
      nodeCount: nodes.length,
      edgeCount: sortedEdges.length,
      nodeLimit: graphConfig.maxNodes,
      edgeLimit: graphConfig.maxEdges,
    },
    metadata: extractBusinessMetrics(report),
  };
}

export async function loadReportData(): Promise<ReportData | null> {
  const possiblePaths = [
    '/report-data.json',
    './report-data.json',
    '../report-data.json',
    '../../report-data.json',
  ];

  for (const path of possiblePaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data = await response.json();
        // If it's a unified report, it might be nested under 'results' if it was a deep clone 
        // but typically unified report IS the data.
        return data;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function getEdgeDistance(type: string): number {
  return (
    GRAPH_CONFIG.edgeDistances[
    type as keyof typeof GRAPH_CONFIG.edgeDistances
    ] ?? GRAPH_CONFIG.edgeDistances.dependency
  );
}

export function getEdgeStrength(type: string): number {
  return (
    GRAPH_CONFIG.edgeStrengths[
    type as keyof typeof GRAPH_CONFIG.edgeStrengths
    ] ?? GRAPH_CONFIG.edgeStrengths.dependency
  );
}

export function getEdgeOpacity(type: string): number {
  return (
    GRAPH_CONFIG.edgeOpacities[
    type as keyof typeof GRAPH_CONFIG.edgeOpacities
    ] ?? GRAPH_CONFIG.edgeOpacities.dependency
  );
}

export function getEdgeStrokeWidth(type: string): number {
  return type === 'similarity' ? 2 : 1;
}
