#!/usr/bin/env node

import { Command } from 'commander';
import { analyzePatterns, generateSummary, detectDuplicatePatterns } from './index';
import type { PatternType, DuplicatePattern } from './detector';
import { filterBySeverity, getSeverityLabel, type Severity } from './context-rules';
import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { loadConfig, mergeConfigWithDefaults, resolveOutputPath } from '@aiready/core';

const program = new Command();

program
  .name('aiready-patterns')
  .description('Detect duplicate patterns in your codebase')
  .version('0.1.0')
  .addHelpText('after', '\nCONFIGURATION:\n  Supports config files: aiready.json, aiready.config.json, .aiready.json, .aireadyrc.json, aiready.config.js, .aireadyrc.js\n  CLI options override config file settings\n\nPARAMETER TUNING:\n  If you get too few results: decrease --similarity, --min-lines, or --min-shared-tokens\n  If analysis is too slow: increase --min-lines, --min-shared-tokens, or decrease --max-candidates\n  If you get too many false positives: increase --similarity or --min-lines\n\nEXAMPLES:\n  aiready-patterns .                                    # Basic analysis with smart defaults\n  aiready-patterns . --similarity 0.3 --min-lines 3     # More sensitive detection\n  aiready-patterns . --max-candidates 50 --no-approx    # Slower but more thorough\n  aiready-patterns . --output json > report.json       # JSON export')
  .argument('<directory>', 'Directory to analyze')
  .option('-s, --similarity <number>', 'Minimum similarity score (0-1). Lower = more results, higher = fewer but more accurate. Default: 0.4')
  .option('-l, --min-lines <number>', 'Minimum lines to consider. Lower = more results, higher = faster analysis. Default: 5')
  .option('--batch-size <number>', 'Batch size for comparisons. Higher = faster but more memory. Default: 100')
  .option('--no-approx', 'Disable approximate candidate selection. Slower but more thorough on small repos')
  .option('--min-shared-tokens <number>', 'Minimum shared tokens to consider a candidate. Higher = faster, fewer results. Default: 8')
  .option('--max-candidates <number>', 'Maximum candidates per block. Higher = more thorough but slower. Default: 100')
  .option('--no-stream-results', 'Disable incremental output (default: enabled)')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('--min-severity <level>', 'Minimum severity to show: critical|high|medium|low|info. Default: medium')
  .option('--exclude-test-fixtures', 'Exclude test fixture duplication (beforeAll/afterAll)')
  .option('--exclude-templates', 'Exclude template file duplication')
  .option('--include-tests', 'Include test files in analysis (excluded by default)')
  .option('--max-results <number>', 'Maximum number of results to show in console output. Default: 10')
  .option(
    '-o, --output <format>',
    'Output format: console, json, html',
    'console'
  )
  .option('--output-file <path>', 'Output file path (for json/html)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing patterns...\n'));

    const startTime = Date.now();

    // Load config file if it exists
    const config = loadConfig(directory);

    // Define defaults
    const defaults = {
      minSimilarity: 0.4,
      minLines: 5,
      batchSize: 100,
      approx: true,
      minSharedTokens: 8,
      maxCandidatesPerBlock: 100,
      streamResults: true,
      include: undefined,
      exclude: undefined,
      minSeverity: 'medium' as Severity,
      excludeTestFixtures: false,
      excludeTemplates: false,
      includeTests: false,
      maxResults: 10,
    };

    // Merge config with defaults
    const mergedConfig = mergeConfigWithDefaults(config, defaults);

    // Override with CLI options (CLI takes precedence)
    const finalOptions = {
      rootDir: directory,
      minSimilarity: options.similarity ? parseFloat(options.similarity) : mergedConfig.minSimilarity,
      minLines: options.minLines ? parseInt(options.minLines) : mergedConfig.minLines,
      batchSize: options.batchSize ? parseInt(options.batchSize) : mergedConfig.batchSize,
      approx: options.approx !== false && mergedConfig.approx, // CLI --no-approx takes precedence
      minSharedTokens: options.minSharedTokens ? parseInt(options.minSharedTokens) : mergedConfig.minSharedTokens,
      maxCandidatesPerBlock: options.maxCandidates ? parseInt(options.maxCandidates) : mergedConfig.maxCandidatesPerBlock,
      streamResults: options.streamResults !== false && mergedConfig.streamResults,
      include: options.include?.split(',') || mergedConfig.include,
      exclude: options.exclude?.split(',') || mergedConfig.exclude,
      minSeverity: (options.minSeverity || mergedConfig.minSeverity) as Severity,
      excludeTestFixtures: options.excludeTestFixtures || mergedConfig.excludeTestFixtures,
      excludeTemplates: options.excludeTemplates || mergedConfig.excludeTemplates,
      includeTests: options.includeTests || mergedConfig.includeTests,
      maxResults: options.maxResults ? parseInt(options.maxResults) : mergedConfig.maxResults,
    };

    // Handle test file exclusion by default
    if (!finalOptions.includeTests) {
      const testPatterns = [
        '**/*.test.*',
        '**/*.spec.*',
        '**/__tests__/**',
        '**/test/**',
        '**/*.test',
        '**/*.spec',
      ];
      finalOptions.exclude = finalOptions.exclude
        ? [...finalOptions.exclude, ...testPatterns]
        : testPatterns;
    }

    const { results, duplicates: rawDuplicates, files } = await analyzePatterns(finalOptions);

    // Apply severity filtering
    let filteredDuplicates = rawDuplicates;
    
    // Filter by minimum severity
    if (finalOptions.minSeverity) {
      filteredDuplicates = filterBySeverity(filteredDuplicates, finalOptions.minSeverity);
    }
    
    // Filter out test fixtures if requested
    if (finalOptions.excludeTestFixtures) {
      filteredDuplicates = filteredDuplicates.filter(d => d.matchedRule !== 'test-fixtures');
    }
    
    // Filter out templates if requested
    if (finalOptions.excludeTemplates) {
      filteredDuplicates = filteredDuplicates.filter(d => d.matchedRule !== 'templates');
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = generateSummary(results);
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

    if (options.output === 'json') {
      const jsonOutput = {
        summary,
        results,
        timestamp: new Date().toISOString(),
      };

      const outputPath = resolveOutputPath(
        options.outputFile,
        `pattern-report-${new Date().toISOString().split('T')[0]}.json`,
        directory
      );
      
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
      console.log(chalk.green(`\n✓ JSON report saved to ${outputPath}`));
      return;
    }

    if (options.output === 'html') {
      const html = generateHTMLReport(summary, results);
      const outputPath = resolveOutputPath(
        options.outputFile,
        `pattern-report-${new Date().toISOString().split('T')[0]}.html`,
        directory
      );
      
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      writeFileSync(outputPath, html);
      console.log(chalk.green(`\n✓ HTML report saved to ${outputPath}`));
      return;
    }

    // Console output
    const terminalWidth = process.stdout.columns || 80;
    const dividerWidth = Math.min(60, terminalWidth - 2);
    const divider = '━'.repeat(dividerWidth);
    
    console.log(chalk.cyan(divider));
    console.log(chalk.bold.white('  PATTERN ANALYSIS SUMMARY'));
    console.log(chalk.cyan(divider) + '\n');

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
    console.log(
      chalk.gray(`⏱  Analysis time: ${chalk.bold(elapsedTime + 's')}`)
    );

    // Show breakdown by pattern type (only if duplicates exist)
    const sortedTypes = Object.entries(summary.patternsByType)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);

    if (sortedTypes.length > 0) {
      console.log(chalk.cyan('\n' + divider));
      console.log(chalk.bold.white('  PATTERNS BY TYPE'));
      console.log(chalk.cyan(divider) + '\n');

      sortedTypes.forEach(([type, count]) => {
        const icon = getPatternIcon(type as PatternType);
        console.log(`${icon} ${chalk.white(type.padEnd(15))} ${chalk.bold(count)}`);
      });
    }

    // Show top duplicates with detailed information
    if (totalIssues > 0) {
      console.log(chalk.cyan('\n' + divider));
      console.log(chalk.bold.white('  TOP DUPLICATE PATTERNS'));
      console.log(chalk.cyan(divider) + '\n');

      // Sort by severity (critical first), then similarity
      const severityOrder: Record<Severity, number> = {
        critical: 5,
        high: 4,
        medium: 3,
        low: 2,
        info: 1,
      };

      const topDuplicates = filteredDuplicates
        .sort((a, b) => {
          const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
          if (severityDiff !== 0) return severityDiff;
          return b.similarity - a.similarity;
        })
        .slice(0, finalOptions.maxResults);

      topDuplicates.forEach((dup, idx) => {
        const severityBadge = getSeverityBadge(dup.severity);

        // Get relative file names for cleaner display
        const file1Name = dup.file1.split('/').pop() || dup.file1;
        const file2Name = dup.file2.split('/').pop() || dup.file2;

        console.log(`${severityBadge} ${chalk.bold(file1Name)} ↔ ${chalk.bold(file2Name)}`);
        console.log(`   Similarity: ${chalk.bold(Math.round(dup.similarity * 100) + '%')} | Pattern: ${dup.patternType} | Tokens: ${chalk.bold(dup.tokenCost.toLocaleString())}`);
        console.log(`   ${chalk.gray(dup.file1)}:${chalk.cyan(dup.line1 + '-' + dup.endLine1)}`);
        console.log(`   ${chalk.gray(dup.file2)}:${chalk.cyan(dup.line2 + '-' + dup.endLine2)}`);
        
        if (dup.reason) {
          console.log(`   ${chalk.italic.gray(dup.reason)}`);
        }
        if (dup.suggestion) {
          console.log(`   ${chalk.cyan('→')} ${chalk.italic(dup.suggestion)}`);
        }
        console.log();
      });
      
      // Show count of filtered duplicates
      if (filteredDuplicates.length > topDuplicates.length) {
        console.log(chalk.gray(`   ... and ${filteredDuplicates.length - topDuplicates.length} more duplicates`));
      }
    }

    // Show detailed issues for critical ones
    const allIssues = results.flatMap((r) =>
      r.issues.map((issue) => ({ ...issue, file: r.fileName }))
    );

    const criticalIssues = allIssues.filter(
      (issue) => issue.severity === 'critical'
    );

    if (criticalIssues.length > 0) {
      console.log(chalk.cyan(divider));
      console.log(chalk.bold.white('  CRITICAL ISSUES (>95% similar)'));
      console.log(chalk.cyan(divider) + '\n');

      criticalIssues.slice(0, 5).forEach((issue) => {
        console.log(chalk.red('● ') + chalk.white(`${issue.file}:${issue.location.line}`));
        console.log(`  ${chalk.dim(issue.message)}`);
        console.log(`  ${chalk.green('→')} ${chalk.italic(issue.suggestion)}\n`);
      });
    }

    // Show a success message if no duplicates
    if (totalIssues === 0) {
      console.log(chalk.green('\n✨ Great! No duplicate patterns detected.\n'));
      console.log(chalk.yellow('💡 If you expected to find duplicates, try adjusting parameters:'));
      console.log(chalk.dim('   • Lower similarity threshold: --similarity 0.3'));
      console.log(chalk.dim('   • Reduce minimum lines: --min-lines 3'));
      console.log(chalk.dim('   • Include test files: --include-tests'));
      console.log(chalk.dim('   • Lower shared tokens threshold: --min-shared-tokens 5'));
      console.log('');
    }

    // Show guidance if very few results
    if (totalIssues > 0 && totalIssues < 5) {
      console.log(chalk.yellow('\n💡 Few results found. To find more duplicates, try:'));
      console.log(chalk.dim('   • Lower similarity threshold: --similarity 0.3'));
      console.log(chalk.dim('   • Reduce minimum lines: --min-lines 3'));
      console.log(chalk.dim('   • Include test files: --include-tests'));
      console.log(chalk.dim('   • Lower shared tokens threshold: --min-shared-tokens 5'));
      console.log('');
    }

    console.log(chalk.cyan(divider));
    
    if (totalIssues > 0) {
      console.log(
        chalk.white(
          `\n💡 Run with ${chalk.bold('--output json')} or ${chalk.bold('--output html')} for detailed reports`
        )
      );
    }

    console.log(
      chalk.dim(
        '\n⭐ Like AIReady? Star us on GitHub: https://github.com/caopengau/aiready-pattern-detect'
      )
    );
    console.log(
      chalk.dim('🐛 Found a bug? Report it: https://github.com/caopengau/aiready-pattern-detect/issues\n')
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
          <th>Files</th>
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
            <td>${dup.files.map((f: any) => `<code>${f.path}:${f.startLine}-${f.endLine}</code>`).join('<br>↔<br>')}</td>
            <td>${dup.tokenCost.toLocaleString()}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Generated by <strong>@aiready/pattern-detect</strong></p>
    <p>Like AIReady? <a href="https://github.com/caopengau/aiready-pattern-detect">Star us on GitHub</a></p>
    <p>Found a bug? <a href="https://github.com/caopengau/aiready-pattern-detect/issues">Report it here</a></p>
  </div>
</body>
</html>`;
}

program.parse();

/**
 * Get colored severity badge for console output
 */
function getSeverityBadge(severity: Severity): string {
  const badges: Record<Severity, string> = {
    critical: chalk.bgRed.white.bold(' CRITICAL '),
    high: chalk.bgYellow.black.bold(' HIGH '),
    medium: chalk.bgBlue.white.bold(' MEDIUM '),
    low: chalk.bgGray.white(' LOW '),
    info: chalk.bgCyan.black(' INFO '),
  };
  return badges[severity] || badges.info;
}

