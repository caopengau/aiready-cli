/**
 * Graph builder - transforms AIReady analysis results into graph data
 */

import fs from 'fs';
import path from 'path';
import {
  Severity,
  UnifiedReportSchema,
  ToolName,
  normalizeAnalysisResult,
  type Issue,
} from '@aiready/core';
import type { GraphData, FileNode, DependencyEdge } from '../types';
import {
  GRAPH_CONSTANTS,
  normalizeLabel,
  extractReferencedPaths,
  getPackageGroup,
  rankSeverity,
  getColorForSeverity,
} from './utils';

/**
 * Metadata for tracking file-level issue aggregates during graph building.
 */
interface FileIssueRecord {
  count: number;
  maxSeverity: Severity | null;
  duplicates: number;
}

/**
 * GraphBuilder: programmatic builder and report-based builder.
 * @lastUpdated 2026-03-27
 */
export class GraphBuilder {
  private readonly rootDir: string;
  private readonly nodesMap: Map<string, FileNode>;
  private readonly edges: DependencyEdge[];
  private readonly edgesSet: Set<string>;

  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.nodesMap = new Map();
    this.edges = [];
    this.edgesSet = new Set();
  }

  /**
   * Add a new node to the graph or update an existing one.
   */
  addNode(
    file: string,
    title = '',
    size = GRAPH_CONSTANTS.DEFAULT_NODE_SIZE
  ): void {
    if (!file) return;
    const id = path.resolve(this.rootDir, file);
    const existingNode = this.nodesMap.get(id);

    if (!existingNode) {
      const node: FileNode = {
        id,
        path: id,
        label: normalizeLabel(id, this.rootDir),
        title,
        size: size,
      };
      this.nodesMap.set(id, node);
    } else {
      if (
        title &&
        (!existingNode.title || !existingNode.title.includes(title))
      ) {
        existingNode.title =
          (existingNode.title ? existingNode.title + '\n' : '') + title;
      }
      if (size > (existingNode.size ?? 0)) {
        existingNode.size = size;
      }
    }
  }

  /**
   * Add a directed edge between two nodes in the graph.
   */
  addEdge(from: string, to: string, type: string = 'link'): void {
    if (!from || !to) return;
    const source = path.resolve(this.rootDir, from);
    const target = path.resolve(this.rootDir, to);
    if (source === target) return;

    const key = `${source}->${target}`;
    if (!this.edgesSet.has(key)) {
      this.edges.push({
        source,
        target,
        type: type as 'dependency' | 'similar' | 'shared',
      });
      this.edgesSet.add(key);
    }
  }

  /**
   * Build the final GraphData object from collected nodes and edges.
   */
  build(): GraphData {
    const nodes = Array.from(this.nodesMap.values());
    return {
      nodes,
      edges: [...this.edges],
      clusters: [],
      issues: [],
      metadata: {
        timestamp: new Date().toISOString(),
        totalFiles: nodes.length,
        totalDependencies: this.edges.length,
        analysisTypes: [],
        criticalIssues: 0,
        majorIssues: 0,
        minorIssues: 0,
        infoIssues: 0,
      },
      truncated: {
        nodes: false,
        edges: false,
      },
    };
  }

  /**
   * Static helper to build graph from an AIReady report JSON.
   */
  static buildFromReport(report: any, rootDir = process.cwd()): GraphData {
    const validation = UnifiedReportSchema.safeParse(report);
    if (!validation.success) {
      console.warn(
        'Visualizer: Report does not fully match UnifiedReportSchema, proceeding with best-effort parsing.'
      );
    }

    const builder = new GraphBuilder(rootDir);
    const fileIssues = new Map<string, FileIssueRecord>();

    const bumpIssue = (file: string, severity?: Severity | null) => {
      if (!file) return;
      const id = path.resolve(rootDir, file);
      if (!fileIssues.has(id)) {
        fileIssues.set(id, { count: 0, maxSeverity: null, duplicates: 0 });
      }
      const record = fileIssues.get(id)!;
      record.count += 1;

      if (severity) {
        if (
          !record.maxSeverity ||
          GRAPH_CONSTANTS.SEVERITY_ORDER[severity] >
            GRAPH_CONSTANTS.SEVERITY_ORDER[record.maxSeverity]
        ) {
          record.maxSeverity = severity;
        }
      }
    };

    const getResults = (toolKey: string, legacyKey?: string): any[] => {
      const camelKey = toolKey.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const toolData =
        report[toolKey] ??
        report[camelKey] ??
        (legacyKey ? report[legacyKey] : undefined);
      if (!toolData) return [];
      if (Array.isArray(toolData)) return toolData;
      return toolData.results ?? toolData.issues ?? [];
    };

    // 1. Process Pattern Detect
    this.processPatterns(
      builder,
      getResults(ToolName.PatternDetect, 'patterns'),
      rootDir,
      bumpIssue
    );

    // 2. Process Duplicates
    this.processDuplicates(builder, report, rootDir, fileIssues);

    // 3. Process Context Analyzer
    this.processContext(
      builder,
      getResults(ToolName.ContextAnalyzer, 'context'),
      rootDir,
      bumpIssue
    );

    // 4. Process Other Tools
    this.processToolResults(
      builder,
      ToolName.DocDrift,
      'docDrift',
      report,
      bumpIssue,
      'Doc-Drift Issue'
    );
    this.processToolResults(
      builder,
      ToolName.DependencyHealth,
      'dependencyHealth',
      report,
      bumpIssue,
      'Dependency Issue'
    );
    this.processToolResults(
      builder,
      ToolName.ContractEnforcement,
      'contractEnforcement',
      report,
      bumpIssue,
      'Contract Gap'
    );

    return this.finalizeGraph(builder, fileIssues, report);
  }

  private static processPatterns(
    builder: GraphBuilder,
    results: any[],
    rootDir: string,
    bumpIssue: (file: string, sev?: Severity | null) => void
  ): void {
    const basenameMap = new Map<string, Set<string>>();
    results.forEach((p: any) => {
      const fileName = p.fileName ?? p.file;
      if (fileName) {
        const base = path.basename(fileName);
        if (!basenameMap.has(base)) basenameMap.set(base, new Set());
        basenameMap.get(base)!.add(fileName);
      }
    });

    results.forEach((entry: any) => {
      const normalized = normalizeAnalysisResult(entry);
      const file = normalized.fileName;
      if (!file) return;

      builder.addNode(
        file,
        `Issues: ${normalized.issues.length}`,
        normalized.metrics.tokenCost || GRAPH_CONSTANTS.DEFAULT_REFERENCE_SIZE
      );

      // We use entry.issues directly if available to detect unspecified severity
      const rawIssues = Array.isArray(entry.issues) ? entry.issues : [];
      if (rawIssues.length > 0) {
        rawIssues.forEach((issue: any) => {
          bumpIssue(file, rankSeverity(issue.severity));
        });
      } else {
        normalized.issues.forEach((issue: Issue) => {
          bumpIssue(file, issue.severity);
        });
      }

      normalized.issues.forEach((issue: Issue) => {
        const refs = extractReferencedPaths(issue.message);
        refs.forEach((ref) => {
          const target = path.isAbsolute(ref)
            ? ref
            : path.resolve(path.dirname(file), ref);
          builder.addNode(
            target,
            'Referenced file',
            GRAPH_CONSTANTS.DEFAULT_REFERENCE_SIZE
          );
          builder.addEdge(file, target, 'reference');
        });

        const percMatch = (issue.message.match(/(\d+)%/) || [])[1];
        const perc = percMatch ? parseInt(percMatch, 10) : null;
        const wantFuzzy =
          issue.type === 'duplicate-pattern' ||
          /similar/i.test(issue.message) ||
          (perc !== null && perc >= GRAPH_CONSTANTS.FUZZY_MATCH_THRESHOLD);

        if (wantFuzzy) {
          const fileGroup = getPackageGroup(file);
          for (const [base, pathsSet] of basenameMap.entries()) {
            if (!issue.message.includes(base) || base === path.basename(file))
              continue;
            for (const target of pathsSet) {
              const targetGroup = getPackageGroup(target);
              if (
                fileGroup !== targetGroup &&
                !(
                  perc !== null &&
                  perc >= GRAPH_CONSTANTS.FUZZY_MATCH_HIGH_THRESHOLD
                )
              )
                continue;
              builder.addNode(
                target,
                'Fuzzy match',
                GRAPH_CONSTANTS.DEFAULT_REFERENCE_SIZE
              );
              builder.addEdge(file, target, 'similarity');
            }
          }
        }
      });
    });
  }

  private static processDuplicates(
    builder: GraphBuilder,
    report: any,
    rootDir: string,
    fileIssues: Map<string, FileIssueRecord>
  ): void {
    const patternData =
      report[ToolName.PatternDetect] ||
      report.patternDetect ||
      report.patterns ||
      {};
    const duplicates =
      (Array.isArray(patternData.duplicates) ? patternData.duplicates : null) ||
      (patternData.summary && Array.isArray(patternData.summary.duplicates)
        ? patternData.summary.duplicates
        : null) ||
      (Array.isArray(report.duplicates) ? report.duplicates : []);

    duplicates.forEach((dup: any) => {
      builder.addNode(
        dup.file1,
        'Similarity target',
        GRAPH_CONSTANTS.DEFAULT_REFERENCE_SIZE
      );
      builder.addNode(
        dup.file2,
        'Similarity target',
        GRAPH_CONSTANTS.DEFAULT_REFERENCE_SIZE
      );
      builder.addEdge(dup.file1, dup.file2, 'similarity');

      [dup.file1, dup.file2].forEach((file) => {
        const id = path.resolve(rootDir, file);
        if (!fileIssues.has(id)) {
          fileIssues.set(id, { count: 0, maxSeverity: null, duplicates: 0 });
        }
        fileIssues.get(id)!.duplicates += 1;
      });
    });
  }

  private static processContext(
    builder: GraphBuilder,
    results: any[],
    rootDir: string,
    bumpIssue: (file: string, sev?: Severity | null) => void
  ): void {
    results.forEach((ctx: any) => {
      const normalized = normalizeAnalysisResult(ctx);
      const file = normalized.fileName;
      if (!file) return;

      builder.addNode(
        file,
        `Deps: ${ctx.dependencyCount || 0}`,
        GRAPH_CONSTANTS.DEFAULT_CONTEXT_SIZE
      );

      normalized.issues.forEach((issue: Issue) => {
        bumpIssue(file, issue.severity);
      });

      (ctx.relatedFiles ?? []).forEach((rel: string) => {
        const resolvedRel = path.isAbsolute(rel)
          ? rel
          : path.resolve(path.dirname(file), rel);
        const resolvedFile = path.resolve(builder.rootDir, file);
        const resolvedTarget = path.resolve(builder.rootDir, resolvedRel);

        const keyA = `${resolvedFile}->${resolvedTarget}`;
        const keyB = `${resolvedTarget}->${resolvedFile}`;

        if (builder['edgesSet'].has(keyA) || builder['edgesSet'].has(keyB))
          return;

        builder.addNode(
          resolvedRel,
          'Related file',
          GRAPH_CONSTANTS.DEFAULT_REFERENCE_SIZE
        );

        const node = builder['nodesMap'].get(resolvedTarget);
        if (node) {
          node.size = (node.size || 1) + 2;
        }
        builder.addEdge(file, resolvedRel, 'related');
      });

      const fileDir = path.dirname(path.resolve(builder.rootDir, file));
      (ctx.dependencyList ?? []).forEach((dep: string) => {
        if (dep.startsWith('.') || dep.startsWith('/')) {
          const possiblePaths = [
            path.resolve(fileDir, dep),
            path.resolve(fileDir, dep + '.ts'),
            path.resolve(fileDir, dep + '.tsx'),
            path.resolve(fileDir, dep + '.js'),
            path.resolve(fileDir, dep, 'index.ts'),
            path.resolve(fileDir, dep, 'index.tsx'),
          ];
          for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
              builder.addNode(
                p,
                'Dependency',
                GRAPH_CONSTANTS.DEFAULT_DEPENDENCY_SIZE
              );
              builder.addEdge(file, p, 'dependency');
              break;
            }
          }
        }
      });
    });
  }

  private static processToolResults(
    builder: GraphBuilder,
    toolName: ToolName,
    legacyKey: string,
    report: any,
    bumpIssue: (file: string, sev?: Severity | null) => void,
    title: string
  ): void {
    const camelKey = toolName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    const toolData = report[toolName] ?? report[camelKey] ?? report[legacyKey];
    if (!toolData) return;

    const results = Array.isArray(toolData)
      ? toolData
      : (toolData.results ?? toolData.issues ?? []);
    results.forEach((item: any) => {
      // Support flat format where item IS the issue (seen in tests and legacy outputs)
      if (!Array.isArray(item.issues) && (item.severity || item.message)) {
        const file = item.fileName ?? item.file ?? item.location?.file;
        if (file) {
          builder.addNode(file, title, GRAPH_CONSTANTS.DEFAULT_REFERENCE_SIZE);
          bumpIssue(file, rankSeverity(item.severity));
        }
        return;
      }

      const normalized = normalizeAnalysisResult(item);
      const file = normalized.fileName;
      if (file) {
        builder.addNode(file, title, GRAPH_CONSTANTS.DEFAULT_REFERENCE_SIZE);
        normalized.issues.forEach((issue) => {
          bumpIssue(file, issue.severity);
        });
      }
    });
  }

  private static finalizeGraph(
    builder: GraphBuilder,
    fileIssues: Map<string, FileIssueRecord>,
    report: any
  ): GraphData {
    const graph = builder.build();

    let criticalIssues = 0;
    let majorIssues = 0;
    let minorIssues = 0;
    let infoIssues = 0;

    graph.nodes.forEach((node) => {
      const record = fileIssues.get(node.id);
      if (record) {
        node.duplicates = record.duplicates || 0;
        node.color = getColorForSeverity(record.maxSeverity);
        node.group = getPackageGroup(node.id);

        if (record.maxSeverity === Severity.Critical)
          criticalIssues += record.count;
        else if (record.maxSeverity === Severity.Major)
          majorIssues += record.count;
        else if (record.maxSeverity === Severity.Minor)
          minorIssues += record.count;
        else if (record.maxSeverity === Severity.Info)
          infoIssues += record.count;
      } else {
        node.color = getColorForSeverity(null);
        node.group = getPackageGroup(node.id);
        node.duplicates = 0;
      }
    });

    graph.metadata = {
      ...graph.metadata,
      criticalIssues,
      majorIssues,
      minorIssues,
      infoIssues,
      tokenBudget: report.scoring?.tokenBudget,
    };

    return graph;
  }
}

/**
 * Create a small sample graph for demonstration or testing purposes.
 */
export function createSampleGraph(): GraphData {
  const builder = new GraphBuilder(process.cwd());
  builder.addNode('src/components/Button.tsx', 'Button', 15);
  builder.addNode('src/utils/helpers.ts', 'helpers', 12);
  builder.addNode('src/services/api.ts', 'api', 18);
  builder.addEdge(
    'src/components/Button.tsx',
    'src/utils/helpers.ts',
    'dependency'
  );
  builder.addEdge('src/utils/helpers.ts', 'src/services/api.ts', 'dependency');
  return builder.build();
}
