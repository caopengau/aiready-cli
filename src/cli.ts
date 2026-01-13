#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeContext, generateSummary } from './index';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, mergeConfigWithDefaults } from '@aiready/core';

const program = new Command();

program
  .name('aiready-context')
  .description('Analyze AI context window cost and code structure')
  .version('0.1.0')
  .addHelpText('after', '\nCONFIGURATION:\n  Supports config files: aiready.json, aiready.config.json, .aiready.json, .aireadyrc.json, aiready.config.js, .aireadyrc.js\n  CLI options override config file settings')
  .argument('<directory>', 'Directory to analyze')
  .option('--max-depth <number>', 'Maximum acceptable import depth')
  .option(
    '--max-context <number>',
    'Maximum acceptable context budget (tokens)'
  )
  .option('--min-cohesion <number>', 'Minimum acceptable cohesion score (0-1)')
  .option(
    '--max-fragmentation <number>',
    'Maximum acceptable fragmentation (0-1)'
  )
  .option(
    '--focus <type>',
    'Analysis focus: fragmentation, cohesion, depth, all'
  )
  .option('--include-node-modules', 'Include node_modules in analysis')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('--max-results <number>', 'Maximum number of results to show in console output')
  .option(
    '-o, --output <format>',
    'Output format: console, json, html',
    'console'
  )
  .option('--output-file <path>', 'Output file path (for json/html)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing context window costs...\n'));

    const startTime = Date.now();

    try {
      // Load config file if it exists
      const config = loadConfig(directory);

      // Define defaults
      const defaults = {
        maxDepth: 5,
        maxContextBudget: 10000,
        minCohesion: 0.6,
        maxFragmentation: 0.5,
        focus: 'all',
        includeNodeModules: false,
        include: undefined,
        exclude: undefined,
        maxResults: 10,
      };

      // Merge config with defaults
      const mergedConfig = mergeConfigWithDefaults(config, defaults);

      // Override with CLI options (CLI takes precedence)
      const finalOptions = {
        rootDir: directory,
        maxDepth: options.maxDepth ? parseInt(options.maxDepth) : mergedConfig.maxDepth,
        maxContextBudget: options.maxContext ? parseInt(options.maxContext) : mergedConfig.maxContextBudget,
        minCohesion: options.minCohesion ? parseFloat(options.minCohesion) : mergedConfig.minCohesion,
        maxFragmentation: options.maxFragmentation ? parseFloat(options.maxFragmentation) : mergedConfig.maxFragmentation,
        focus: (options.focus || mergedConfig.focus) as any,
        includeNodeModules: options.includeNodeModules !== undefined ? options.includeNodeModules : mergedConfig.includeNodeModules,
        include: options.include?.split(',') || mergedConfig.include,
        exclude: options.exclude?.split(',') || mergedConfig.exclude,
        maxResults: options.maxResults ? parseInt(options.maxResults) : mergedConfig.maxResults,
      };

      const results = await analyzeContext(finalOptions);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const summary = generateSummary(results);

      if (options.output === 'json') {
        const jsonOutput = {
          summary,
          results,
          timestamp: new Date().toISOString(),
          analysisTime: elapsedTime,
        };

        if (options.outputFile) {
          writeFileSync(
            options.outputFile,
            JSON.stringify(jsonOutput, null, 2)
          );
          console.log(
            chalk.green(`\n✓ JSON report saved to ${options.outputFile}`)
          );
        } else {
          console.log(JSON.stringify(jsonOutput, null, 2));
        }
        return;
      }

      if (options.output === 'html') {
        const html = generateHTMLReport(summary, results);
        const outputPath =
          options.outputFile || join(process.cwd(), 'context-report.html');
        writeFileSync(outputPath, html);
        console.log(chalk.green(`\n✓ HTML report saved to ${outputPath}`));
        return;
      }

      // Console output
      displayConsoleReport(summary, results, elapsedTime, finalOptions.maxResults);
    } catch (error) {
      console.error(chalk.red('\n❌ Analysis failed:'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program.parse();

/**
 * Display formatted console report
 */
function displayConsoleReport(
  summary: ReturnType<typeof generateSummary>,
  results: Awaited<ReturnType<typeof analyzeContext>>,
  elapsedTime: string,
  maxResults: number = 10
) {
  const terminalWidth = process.stdout.columns || 80;
  const dividerWidth = Math.min(60, terminalWidth - 2);
  const divider = '━'.repeat(dividerWidth);

  console.log(chalk.cyan(divider));
  console.log(chalk.bold.white('  CONTEXT ANALYSIS SUMMARY'));
  console.log(chalk.cyan(divider) + '\n');

  // Overview
  console.log(chalk.white(`📁 Files analyzed: ${chalk.bold(summary.totalFiles)}`));
  console.log(
    chalk.white(`📊 Total tokens: ${chalk.bold(summary.totalTokens.toLocaleString())}`)
  );
  console.log(
    chalk.yellow(
      `💰 Avg context budget: ${chalk.bold(summary.avgContextBudget.toFixed(0))} tokens/file`
    )
  );
  console.log(
    chalk.white(`⏱  Analysis time: ${chalk.bold(elapsedTime + 's')}\n`)
  );

  // Issues summary
  const totalIssues =
    summary.criticalIssues + summary.majorIssues + summary.minorIssues;
  if (totalIssues > 0) {
    console.log(chalk.bold('⚠️  Issues Found:\n'));
    if (summary.criticalIssues > 0) {
      console.log(
        chalk.red(`   🔴 Critical: ${chalk.bold(summary.criticalIssues)}`)
      );
    }
    if (summary.majorIssues > 0) {
      console.log(
        chalk.yellow(`   🟡 Major: ${chalk.bold(summary.majorIssues)}`)
      );
    }
    if (summary.minorIssues > 0) {
      console.log(chalk.blue(`   🔵 Minor: ${chalk.bold(summary.minorIssues)}`));
    }
    console.log(
      chalk.green(
        `\n   💡 Potential savings: ${chalk.bold(summary.totalPotentialSavings.toLocaleString())} tokens\n`
      )
    );
  } else {
    console.log(chalk.green('✅ No significant issues found!\n'));
  }

  // Import depth analysis
  if (summary.deepFiles.length > 0) {
    console.log(chalk.bold('📏 Deep Import Chains:\n'));
    console.log(
      chalk.gray(`   Average depth: ${summary.avgImportDepth.toFixed(1)}`)
    );
    console.log(chalk.gray(`   Maximum depth: ${summary.maxImportDepth}\n`));

    summary.deepFiles.slice(0, maxResults).forEach((item) => {
      const fileName = item.file.split('/').slice(-2).join('/');
      console.log(
        `   ${chalk.cyan('→')} ${chalk.white(fileName)} ${chalk.dim(`(depth: ${item.depth})`)}`
      );
    });
    console.log();
  }

  // Fragmentation analysis
  if (summary.fragmentedModules.length > 0) {
    console.log(chalk.bold('🧩 Fragmented Modules:\n'));
    console.log(
      chalk.gray(
        `   Average fragmentation: ${(summary.avgFragmentation * 100).toFixed(0)}%\n`
      )
    );

    summary.fragmentedModules.slice(0, maxResults).forEach((module) => {
      console.log(
        `   ${chalk.yellow('●')} ${chalk.white(module.domain)} - ${chalk.dim(`${module.files.length} files, ${(module.fragmentationScore * 100).toFixed(0)}% scattered`)}`
      );
      console.log(
        chalk.dim(
          `     Token cost: ${module.totalTokens.toLocaleString()}, Cohesion: ${(module.avgCohesion * 100).toFixed(0)}%`
        )
      );
    });
    console.log();
  }

  // Low cohesion files
  if (summary.lowCohesionFiles.length > 0) {
    console.log(chalk.bold('🔀 Low Cohesion Files:\n'));
    console.log(
      chalk.gray(
        `   Average cohesion: ${(summary.avgCohesion * 100).toFixed(0)}%\n`
      )
    );

    summary.lowCohesionFiles.slice(0, maxResults).forEach((item) => {
      const fileName = item.file.split('/').slice(-2).join('/');
      const scorePercent = (item.score * 100).toFixed(0);
      const color = item.score < 0.4 ? chalk.red : chalk.yellow;
      console.log(
        `   ${color('○')} ${chalk.white(fileName)} ${chalk.dim(`(${scorePercent}% cohesion)`)}`
      );
    });
    console.log();
  }

  // Top expensive files
  if (summary.topExpensiveFiles.length > 0) {
    console.log(chalk.bold('💸 Most Expensive Files (Context Budget):\n'));

    summary.topExpensiveFiles.slice(0, maxResults).forEach((item) => {
      const fileName = item.file.split('/').slice(-2).join('/');
      const severityColor =
        item.severity === 'critical'
          ? chalk.red
          : item.severity === 'major'
          ? chalk.yellow
          : chalk.blue;

      console.log(
        `   ${severityColor('●')} ${chalk.white(fileName)} ${chalk.dim(`- ${item.contextBudget.toLocaleString()} tokens`)}`
      );
    });
    console.log();
  }

  // Recommendations
  if (totalIssues > 0) {
    console.log(chalk.bold('💡 Top Recommendations:\n'));

    const topFiles = results
      .filter((r) => r.severity === 'critical' || r.severity === 'major')
      .slice(0, 3);

    topFiles.forEach((result, index) => {
      const fileName = result.file.split('/').slice(-2).join('/');
      console.log(chalk.cyan(`   ${index + 1}. ${fileName}`));
      result.recommendations.slice(0, 2).forEach((rec) => {
        console.log(chalk.dim(`      • ${rec}`));
      });
    });
    console.log();
  }

  // Footer
  console.log(chalk.cyan(divider));
  console.log(
    chalk.dim(
      '\n⭐ Like AIReady? Star us on GitHub: https://github.com/caopengau/aiready-context-analyzer'
    )
  );
  console.log(
    chalk.dim('🐛 Found a bug? Report it: https://github.com/caopengau/aiready-context-analyzer/issues\n')
  );
}

/**
 * Generate HTML report
 */
function generateHTMLReport(
  summary: ReturnType<typeof generateSummary>,
  results: Awaited<ReturnType<typeof analyzeContext>>
): string {
  const totalIssues =
    summary.criticalIssues + summary.majorIssues + summary.minorIssues;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AIReady Context Analysis Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    h1, h2, h3 { color: #2c3e50; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
    }
    .label {
      color: #666;
      font-size: 0.9em;
      margin-top: 5px;
    }
    .issue-critical { color: #e74c3c; }
    .issue-major { color: #f39c12; }
    .issue-minor { color: #3498db; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background-color: #667eea;
      color: white;
      font-weight: 600;
    }
    tr:hover { background-color: #f8f9fa; }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 AIReady Context Analysis Report</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>

  <div class="summary">
    <div class="card">
      <div class="metric">${summary.totalFiles}</div>
      <div class="label">Files Analyzed</div>
    </div>
    <div class="card">
      <div class="metric">${summary.totalTokens.toLocaleString()}</div>
      <div class="label">Total Tokens</div>
    </div>
    <div class="card">
      <div class="metric">${summary.avgContextBudget.toFixed(0)}</div>
      <div class="label">Avg Context Budget</div>
    </div>
    <div class="card">
      <div class="metric ${totalIssues > 0 ? 'issue-major' : ''}">${totalIssues}</div>
      <div class="label">Total Issues</div>
    </div>
  </div>

  ${totalIssues > 0 ? `
  <div class="card" style="margin-bottom: 30px;">
    <h2>⚠️ Issues Summary</h2>
    <p>
      <span class="issue-critical">🔴 Critical: ${summary.criticalIssues}</span> &nbsp;
      <span class="issue-major">🟡 Major: ${summary.majorIssues}</span> &nbsp;
      <span class="issue-minor">🔵 Minor: ${summary.minorIssues}</span>
    </p>
    <p><strong>Potential Savings:</strong> ${summary.totalPotentialSavings.toLocaleString()} tokens</p>
  </div>
  ` : ''}

  ${summary.fragmentedModules.length > 0 ? `
  <div class="card" style="margin-bottom: 30px;">
    <h2>🧩 Fragmented Modules</h2>
    <table>
      <thead>
        <tr>
          <th>Domain</th>
          <th>Files</th>
          <th>Fragmentation</th>
          <th>Token Cost</th>
        </tr>
      </thead>
      <tbody>
        ${summary.fragmentedModules.map(m => `
          <tr>
            <td>${m.domain}</td>
            <td>${m.files.length}</td>
            <td>${(m.fragmentationScore * 100).toFixed(0)}%</td>
            <td>${m.totalTokens.toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${summary.topExpensiveFiles.length > 0 ? `
  <div class="card" style="margin-bottom: 30px;">
    <h2>💸 Most Expensive Files</h2>
    <table>
      <thead>
        <tr>
          <th>File</th>
          <th>Context Budget</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        ${summary.topExpensiveFiles.map(f => `
          <tr>
            <td>${f.file}</td>
            <td>${f.contextBudget.toLocaleString()} tokens</td>
            <td class="issue-${f.severity}">${f.severity.toUpperCase()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by <strong>@aiready/context-analyzer</strong></p>
    <p>Like AIReady? <a href="https://github.com/caopengau/aiready-context-analyzer">Star us on GitHub</a></p>
    <p>Found a bug? <a href="https://github.com/caopengau/aiready-context-analyzer/issues">Report it here</a></p>
  </div>
</body>
</html>`;
}
