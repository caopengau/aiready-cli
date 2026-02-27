/**
 * Shared helper functions for CLI commands
 */

import { resolve as resolvePath } from 'path';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import chalk from 'chalk';

/**
 * Generate timestamp for report filenames (YYYYMMDD-HHMMSS)
 * Provides better granularity than date-only filenames
 */
export function getReportTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Find the latest aiready report in the .aiready directory
 * Searches for both new format (aiready-report-*) and legacy format (aiready-scan-*)
 */
export function findLatestScanReport(dirPath: string): string | null {
  const aireadyDir = resolvePath(dirPath, '.aiready');
  if (!existsSync(aireadyDir)) {
    return null;
  }

  // Search for new format first, then legacy format
  let files = readdirSync(aireadyDir).filter(
    (f) => f.startsWith('aiready-report-') && f.endsWith('.json')
  );
  if (files.length === 0) {
    files = readdirSync(aireadyDir).filter(
      (f) => f.startsWith('aiready-scan-') && f.endsWith('.json')
    );
  }

  if (files.length === 0) {
    return null;
  }

  // Sort by modification time, most recent first
  const sortedFiles = files
    .map((f) => ({
      name: f,
      path: resolvePath(aireadyDir, f),
      mtime: statSync(resolvePath(aireadyDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return sortedFiles[0].path;
}

/**
 * Warn if graph caps may be exceeded
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
 * Generate markdown report for consistency command
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
 * Truncate array for display (show first N items with "... +N more")
 */
export function truncateArray(arr: any[] | undefined, cap = 8): string {
  if (!Array.isArray(arr)) return '';
  const shown = arr.slice(0, cap).map((v) => String(v));
  const more = arr.length - shown.length;
  return shown.join(', ') + (more > 0 ? `, ... (+${more} more)` : '');
}
