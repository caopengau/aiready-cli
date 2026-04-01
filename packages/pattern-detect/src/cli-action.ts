import { analyzePatterns, generateSummary } from './analyzer';
import { filterBySeverity } from './context-rules';
import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import {
  resolveOutputPath,
  getSeverityValue,
  getTerminalDivider,
} from '@aiready/core';
import { resolvePatternConfig } from './config-resolver';
import { generateHTMLReport } from './cli-output';
import {
  printAnalysisSummary,
  printPatternBreakdown,
  printDuplicateGroups,
  printRefactorClusters,
  printRawDuplicates,
  printCriticalIssues,
} from './terminal-output';

/**
 * Main CLI action handler for pattern detection.
 */
export async function patternActionHandler(directory: string, options: any) {
  console.log(chalk.blue('🔍 Analyzing patterns...\n'));

  const startTime = Date.now();

  // 1. Resolve configuration
  const finalOptions = await resolvePatternConfig(directory, options);

  // 2. Execute analysis
  const {
    results,
    duplicates: rawDuplicates,
    groups,
    clusters,
  } = await analyzePatterns(finalOptions);

  // 3. Post-processing
  let filteredDuplicates = rawDuplicates;
  if (finalOptions.minSeverity) {
    filteredDuplicates = filterBySeverity(
      filteredDuplicates,
      finalOptions.minSeverity
    );
  }

  if (finalOptions.excludeTestFixtures) {
    filteredDuplicates = filteredDuplicates.filter(
      (d) => d.matchedRule !== 'test-fixtures'
    );
  }

  if (finalOptions.excludeTemplates) {
    filteredDuplicates = filteredDuplicates.filter(
      (d) => d.matchedRule !== 'templates'
    );
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const summary = generateSummary(results || []);
  const totalIssues = (results || []).reduce(
    (sum, r) => sum + (r.issues?.length || 0),
    0
  );

  // 4. Output generation
  if (options.output === 'json') {
    handleJsonOutput(options.outputFile, directory, {
      summary,
      results,
      duplicates: rawDuplicates,
      groups: groups || [],
      clusters: clusters || [],
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (options.output === 'html') {
    handleHtmlOutput(options.outputFile, directory, summary, results);
    return;
  }

  // 5. Console output
  renderTerminalOutput(
    results.length,
    totalIssues,
    summary,
    elapsedTime,
    finalOptions,
    groups,
    clusters,
    filteredDuplicates
  );
}

/**
 * Handles JSON report persistence.
 */
function handleJsonOutput(outputFile: string, directory: string, data: any) {
  const outputPath = resolveOutputPath(
    outputFile,
    `pattern-report-${new Date().toISOString().split('T')[0]}.json`,
    directory
  );

  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(chalk.green(`\n✓ JSON report saved to ${outputPath}`));
}

/**
 * Handles HTML report persistence.
 */
function handleHtmlOutput(
  outputFile: string,
  directory: string,
  summary: any,
  results: any
) {
  const html = generateHTMLReport(summary, results);
  const outputPath = resolveOutputPath(
    outputFile,
    `pattern-report-${new Date().toISOString().split('T')[0]}.html`,
    directory
  );

  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(outputPath, html);
  console.log(chalk.green(`\n✓ HTML report saved to ${outputPath}`));
}

/**
 * Renders the full terminal report.
 */
function renderTerminalOutput(
  fileCount: number,
  totalIssues: number,
  summary: any,
  elapsedTime: string,
  options: any,
  groups: any[] | undefined,
  clusters: any[] | undefined,
  filteredDuplicates: any[]
) {
  printAnalysisSummary(
    fileCount,
    totalIssues,
    summary.totalTokenCost,
    elapsedTime
  );
  printPatternBreakdown(summary.patternsByType);

  if (!options.showRawDuplicates && groups && groups.length > 0) {
    printDuplicateGroups(groups, options.maxResults);
  }

  if (!options.showRawDuplicates && clusters && clusters.length > 0) {
    printRefactorClusters(clusters);
  }

  if (
    totalIssues > 0 &&
    (options.showRawDuplicates || !groups || groups.length === 0)
  ) {
    printRawDuplicates(filteredDuplicates, options.maxResults);
  }

  const criticalIssues = resultsToCriticalIssues(summary, filteredDuplicates);
  printCriticalIssues(criticalIssues);

  if (totalIssues === 0) {
    printSuccessMessage();
  } else if (totalIssues < 5) {
    printGuidance();
  }

  console.log(getTerminalDivider());
  if (totalIssues > 0) {
    console.log(
      chalk.white(
        `\n💡 Run with ${chalk.bold('--output json')} or ${chalk.bold('--output html')} for detailed reports`
      )
    );
  }
  printFooter();
}

/**
 * Helper to extract critical issues from results.
 */
function resultsToCriticalIssues(summary: any, duplicates: any[]) {
  return duplicates
    .filter((d) => getSeverityValue(d.severity) === 4)
    .map((d) => ({
      file: d.file1,
      location: { line: d.line1 },
      message: `${d.patternType} pattern highly similar to ${d.file2}`,
      suggestion: d.suggestion,
      severity: d.severity,
    }));
}

function printSuccessMessage() {
  console.log(chalk.green('\n✨ Great! No duplicate patterns detected.\n'));
  console.log(
    chalk.yellow(
      '💡 If you expected to find duplicates, try adjusting parameters:'
    )
  );
  console.log(chalk.dim('   • Lower similarity threshold: --similarity 0.3'));
  console.log(chalk.dim('   • Reduce minimum lines: --min-lines 3'));
  console.log(chalk.dim('   • Include test files: --include-tests'));
  console.log(
    chalk.dim('   • Lower shared tokens threshold: --min-shared-tokens 5\n')
  );
}

function printGuidance() {
  console.log(
    chalk.yellow('\n💡 Few results found. To find more duplicates, try:')
  );
  console.log(chalk.dim('   • Lower similarity threshold: --similarity 0.3'));
  console.log(chalk.dim('   • Reduce minimum lines: --min-lines 3'));
  console.log(chalk.dim('   • Include test files: --include-tests\n'));
}

function printFooter() {
  console.log(
    chalk.dim(
      '\n⭐ Like AIReady? Star us on GitHub: https://github.com/getaiready/aiready-pattern-detect'
    )
  );
  console.log(
    chalk.dim(
      '🐛 Found a bug? Report it: https://github.com/getaiready/aiready-pattern-detect/issues\n'
    )
  );
}
