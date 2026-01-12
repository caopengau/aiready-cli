#!/usr/bin/env node

import { Command } from 'commander';
import { analyzePatterns, generateSummary } from './index';
import type { PatternType } from './detector';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .name('aiready-patterns')
  .description('Detect duplicate patterns in your codebase')
  .version('0.1.0')
  .argument('<directory>', 'Directory to analyze')
  .option('-s, --similarity <number>', 'Minimum similarity score (0-1)', '0.85')
  .option('-l, --min-lines <number>', 'Minimum lines to consider', '5')
  .option('--max-blocks <number>', 'Maximum blocks to analyze (prevents OOM)', '500')
  .option('--batch-size <number>', 'Batch size for comparisons', '100')
  .option('--no-approx', 'Disable approximate candidate selection (faster on small repos, slower on large)')
  .option('--min-shared-tokens <number>', 'Minimum shared tokens to consider a candidate', '8')
  .option('--max-candidates <number>', 'Maximum candidates per block', '100')
  .option('--no-fast-mode', 'Use slower but more accurate Levenshtein distance (default: fast Jaccard)')
  .option('--max-comparisons <number>', 'Maximum total comparisons budget', '50000')
  .option('--stream-results', 'Output duplicates incrementally as found (useful for slow analysis)')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option(
    '-o, --output <format>',
    'Output format: console, json, html',
    'console'
  )
  .option('--output-file <path>', 'Output file path (for json/html)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing patterns...\n'));

    const results = await analyzePatterns({
      rootDir: directory,
      minSimilarity: parseFloat(options.similarity),
      minLines: parseInt(options.minLines),
      maxBlocks: parseInt(options.maxBlocks),
      batchSize: parseInt(options.batchSize),
      approx: options.approx !== false, // default true; --no-approx sets to false
      minSharedTokens: parseInt(options.minSharedTokens),
      maxCandidatesPerBlock: parseInt(options.maxCandidates),
      fastMode: options.fastMode !== false, // default true; --no-fast-mode sets to false
      maxComparisons: parseInt(options.maxComparisons),
      streamResults: options.streamResults === true, // default false; --stream-results sets to true
      include: options.include?.split(','),
      exclude: options.exclude?.split(','),
    });

    const summary = generateSummary(results);
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

    if (options.output === 'json') {
      const jsonOutput = {
        summary,
        results,
        timestamp: new Date().toISOString(),
      };

      if (options.outputFile) {
        writeFileSync(options.outputFile, JSON.stringify(jsonOutput, null, 2));
        console.log(chalk.green(`\n✓ JSON report saved to ${options.outputFile}`));
      } else {
        console.log(JSON.stringify(jsonOutput, null, 2));
      }
      return;
    }

    if (options.output === 'html') {
      const html = generateHTMLReport(summary, results);
      const outputPath = options.outputFile || join(process.cwd(), 'pattern-report.html');
      writeFileSync(outputPath, html);
      console.log(chalk.green(`\n✓ HTML report saved to ${outputPath}`));
      return;
    }

    // Console output
    console.log(chalk.cyan('━'.repeat(60)));
    console.log(chalk.bold.white('  PATTERN ANALYSIS SUMMARY'));
    console.log(chalk.cyan('━'.repeat(60)) + '\n');

    console.log(
      chalk.white(`📁 Files analyzed: ${chalk.bold(results.length)}`)
    );
    console.log(
      chalk.yellow(`⚠  Duplicate patterns found: ${chalk.bold(totalIssues)}`)
    );
    console.log(
      chalk.red(
        `💰 Token cost (wasted): ${chalk.bold(summary.totalTokenCost.toLocaleString())}`
      )
    );

    // Show breakdown by pattern type
    console.log(chalk.cyan('\n━'.repeat(60)));
    console.log(chalk.bold.white('  PATTERNS BY TYPE'));
    console.log(chalk.cyan('━'.repeat(60)) + '\n');

    const sortedTypes = Object.entries(summary.patternsByType)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);

    sortedTypes.forEach(([type, count]) => {
      const icon = getPatternIcon(type as PatternType);
      console.log(`${icon} ${chalk.white(type.padEnd(15))} ${chalk.bold(count)}`);
    });

    // Show top duplicates
    if (summary.topDuplicates.length > 0) {
      console.log(chalk.cyan('\n━'.repeat(60)));
      console.log(chalk.bold.white('  TOP DUPLICATE PATTERNS'));
      console.log(chalk.cyan('━'.repeat(60)) + '\n');

      summary.topDuplicates.slice(0, 10).forEach((dup, idx) => {
        const severityColor =
          dup.similarity > 0.95
            ? chalk.red
            : dup.similarity > 0.9
            ? chalk.yellow
            : chalk.blue;

        console.log(
          `${chalk.dim(`${idx + 1}.`)} ${severityColor(
            `${Math.round(dup.similarity * 100)}%`
          )} ${getPatternIcon(dup.patternType)} ${chalk.white(dup.patternType)}`
        );
        console.log(
          `   ${chalk.dim(dup.file1)}`
        );
        console.log(
          `   ${chalk.dim('↔')} ${chalk.dim(dup.file2)}`
        );
        console.log(
          `   ${chalk.red(`${dup.tokenCost.toLocaleString()} tokens wasted`)}\n`
        );
      });
    }

    // Show detailed issues for critical ones
    const allIssues = results.flatMap((r) =>
      r.issues.map((issue) => ({ ...issue, file: r.fileName }))
    );

    const criticalIssues = allIssues.filter(
      (issue) => issue.severity === 'critical'
    );

    if (criticalIssues.length > 0) {
      console.log(chalk.cyan('━'.repeat(60)));
      console.log(chalk.bold.white('  CRITICAL ISSUES (>95% similar)'));
      console.log(chalk.cyan('━'.repeat(60)) + '\n');

      criticalIssues.slice(0, 5).forEach((issue) => {
        console.log(chalk.red('● ') + chalk.white(`${issue.file}:${issue.location.line}`));
        console.log(`  ${chalk.dim(issue.message)}`);
        console.log(`  ${chalk.green('→')} ${chalk.italic(issue.suggestion)}\n`);
      });
    }

    console.log(chalk.cyan('━'.repeat(60)));
    console.log(
      chalk.white(
        `\n💡 Run with ${chalk.bold('--output json')} or ${chalk.bold('--output html')} for detailed reports\n`
      )
    );
  });

function getPatternIcon(type: PatternType): string {
  const icons: Record<PatternType, string> = {
    'api-handler': '🌐',
    validator: '✓',
    utility: '🔧',
    'class-method': '📦',
    component: '⚛️',
    function: 'ƒ',
    unknown: '❓',
  };
  return icons[type];
}

function generateHTMLReport(
  summary: any,
  results: any[]
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Pattern Detection Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #007acc; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .stat-card { background: #f9f9f9; padding: 20px; border-radius: 6px; border-left: 4px solid #007acc; }
    .stat-value { font-size: 32px; font-weight: bold; color: #007acc; }
    .stat-label { color: #666; font-size: 14px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
    .critical { color: #d32f2f; }
    .major { color: #f57c00; }
    .minor { color: #1976d2; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Pattern Detection Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Files Analyzed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.totalPatterns}</div>
        <div class="stat-label">Duplicate Patterns</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.totalTokenCost.toLocaleString()}</div>
        <div class="stat-label">Tokens Wasted</div>
      </div>
    </div>

    <h2>Top Duplicate Patterns</h2>
    <table>
      <thead>
        <tr>
          <th>Similarity</th>
          <th>Type</th>
          <th>File 1</th>
          <th>File 2</th>
          <th>Token Cost</th>
        </tr>
      </thead>
      <tbody>
        ${summary.topDuplicates
          .slice(0, 20)
          .map(
            (dup: any) => `
          <tr>
            <td class="${dup.similarity > 0.95 ? 'critical' : dup.similarity > 0.9 ? 'major' : 'minor'}">${Math.round(dup.similarity * 100)}%</td>
            <td>${dup.patternType}</td>
            <td><code>${dup.file1}</code></td>
            <td><code>${dup.file2}</code></td>
            <td>${dup.tokenCost.toLocaleString()}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

program.parse();
