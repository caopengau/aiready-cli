/**
 * Shared helper functions for CLI commands
 */

import { resolve as resolvePath } from 'path';
import { existsSync, readFileSync } from 'fs';
import chalk from 'chalk';
import { loadConfig, mergeConfigWithDefaults } from '@aiready/core';
import type { ToolScoringOutput } from '@aiready/core';

// Re-export helpers from core for deduplication
export {
  findLatestReport,
  getReportTimestamp,
  handleJSONOutput,
} from '@aiready/core';

/**
 * Warn if graph caps may be exceeded for visualization.
 *
 * @param report - The combined analysis report.
 * @param dirPath - Root directory to look for configuration.
 */
export async function warnIfGraphCapExceeded(report: any, dirPath: string) {
  try {
    // Use dynamic import and loadConfig to get the raw visualizer config
    // Use dynamic import instead of require
    const { loadConfig } = await import('@aiready/core');
    void loadConfig;

    let graphConfig = { maxNodes: 400, maxEdges: 600 };

    // Try to read aiready.json synchronously
    const configPath = resolvePath(dirPath, 'aiready.json');
    if (existsSync(configPath)) {
      try {
        const rawConfig = JSON.parse(readFileSync(configPath, 'utf8'));
        if (rawConfig.visualizer?.graph) {
          graphConfig = {
            maxNodes:
              rawConfig.visualizer.graph.maxNodes ?? graphConfig.maxNodes,
            maxEdges:
              rawConfig.visualizer.graph.maxEdges ?? graphConfig.maxEdges,
          };
        }
      } catch (err) {
        void err;
      }
    }

    const nodeCount =
      (report.context?.length || 0) + (report.patterns?.length || 0);
    const edgeCount =
      report.context?.reduce((sum: number, ctx: any) => {
        const relCount = ctx.relatedFiles?.length || 0;
        const depCount = ctx.dependencies?.length || 0;
        return sum + relCount + depCount;
      }, 0) || 0;

    if (nodeCount > graphConfig.maxNodes || edgeCount > graphConfig.maxEdges) {
      console.log('');
      console.log(
        chalk.yellow(`⚠️  Graph may be truncated at visualization time:`)
      );
      if (nodeCount > graphConfig.maxNodes) {
        console.log(
          chalk.dim(`   • Nodes: ${nodeCount} > limit ${graphConfig.maxNodes}`)
        );
      }
      if (edgeCount > graphConfig.maxEdges) {
        console.log(
          chalk.dim(`   • Edges: ${edgeCount} > limit ${graphConfig.maxEdges}`)
        );
      }
      console.log(chalk.dim(`   To increase limits, add to aiready.json:`));
      console.log(chalk.dim(`   {`));
      console.log(chalk.dim(`     "visualizer": {`));
      console.log(
        chalk.dim(`       "graph": { "maxNodes": 2000, "maxEdges": 5000 }`)
      );
      console.log(chalk.dim(`     }`));
      console.log(chalk.dim(`   }`));
    }
  } catch (err) {
    void err;
  }
}

/**
 * Generate markdown report for consistency command.
 *
 * @param report - The consistency report object.
 * @param elapsedTime - Time taken for analysis in seconds.
 * @returns Formatted markdown string.
 */
export function generateMarkdownReport(
  report: any,
  elapsedTime: string
): string {
  let markdown = `# Consistency Analysis Report\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}\n`;
  markdown += `**Analysis Time:** ${elapsedTime}s\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `- **Files Analyzed:** ${report.summary.filesAnalyzed}\n`;
  markdown += `- **Total Issues:** ${report.summary.totalIssues}\n`;
  markdown += `  - Naming: ${report.summary.namingIssues}\n`;
  markdown += `  - Patterns: ${report.summary.patternIssues}\n\n`;

  if (report.recommendations.length > 0) {
    markdown += `## Recommendations\n\n`;
    report.recommendations.forEach((rec: string, i: number) => {
      markdown += `${i + 1}. ${rec}\n`;
    });
  }

  return markdown;
}

/**
 * Truncate array for display (show first N items with "... +N more").
 *
 * @param arr - The array to truncate.
 * @param cap - Maximum number of items to show before truncating.
 * @returns Formatted string for display.
 */
export function truncateArray(arr: any[] | undefined, cap = 8): string {
  if (!Array.isArray(arr)) return '';
  const shown = arr.slice(0, cap).map((v) => String(v));
  const more = arr.length - shown.length;
  return shown.join(', ') + (more > 0 ? `, ... (+${more} more)` : '');
}

/**
 * Build a common ToolScoringOutput payload from a tool report.
 *
 * @param toolName - Identifier for the tool.
 * @param report - Minimal report structure containing score and recommendations.
 * @returns Standardized scoring output.
 */
export function buildToolScoringOutput(
  toolName: string,
  report: {
    summary: { score: number };
    rawData?: Record<string, unknown>;
    recommendations?: string[];
  }
): ToolScoringOutput {
  return {
    toolName,
    score: report.summary.score,
    rawMetrics: report.rawData ?? {},
    factors: [],
    recommendations: (report.recommendations ?? []).map((action: string) => ({
      action,
      estimatedImpact: 5,
      priority: 'medium',
    })),
  };
}

/**
 * Load config and apply tool-level defaults.
 *
 * @param directory - Directory to search for config.
 * @param defaults - Tool-specific default values.
 * @returns Merged configuration with tool defaults.
 */
export async function loadMergedToolConfig<T extends Record<string, unknown>>(
  directory: string,
  defaults: T
): Promise<T & Record<string, unknown>> {
  const config = await loadConfig(directory);
  return mergeConfigWithDefaults(config, defaults) as T &
    Record<string, unknown>;
}

/**
 * Shared base scan options used by CLI tool commands.
 *
 * @param directory - Root directory for scanning.
 * @param options - CLI commander options object.
 * @param extras - Additional tool-specific options.
 * @returns Combined scan options for the analyzer.
 */
export function buildCommonScanOptions(
  directory: string,
  options: any,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    rootDir: directory,
    include: options.include,
    exclude: options.exclude,
    ...extras,
  };
}

/**
 * Execute a config-driven tool command with shared CLI plumbing.
 *
 * @param params - Execution parameters including analyze and score callbacks.
 * @returns Promise resolving to the tool report and its scoring output.
 */
export async function runConfiguredToolCommand<TReport, TScoring>(params: {
  directory: string;
  options: any;
  defaults: Record<string, unknown>;
  analyze: (scanOptions: any) => Promise<TReport>;
  getExtras: (
    options: any,
    merged: Record<string, unknown>
  ) => Record<string, unknown>;
  score: (report: TReport) => TScoring;
}): Promise<{ report: TReport; scoring: TScoring }> {
  const merged = await loadMergedToolConfig(params.directory, params.defaults);
  const report = await params.analyze(
    buildCommonScanOptions(
      params.directory,
      params.options,
      params.getExtras(params.options, merged)
    )
  );
  return {
    report,
    scoring: params.score(report),
  };
}
