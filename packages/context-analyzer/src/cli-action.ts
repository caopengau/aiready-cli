import {
  loadMergedConfig,
  handleJSONOutput,
  handleCLIError,
  getElapsedTime,
  resolveOutputPath,
} from '@aiready/core';
import { analyzeContext } from './orchestrator';
import { generateSummary } from './summary';
import { displayConsoleReport } from './report/console-report';
import { generateHTMLReport } from './report/html-report';
import { runInteractiveSetup } from './report/interactive-setup';
import chalk from 'chalk';
import { writeFileSync } from 'fs';

/**
 * Orchestrates the context analysis CLI command.
 * Merges configuration, invokes the analyzer, and formats the output (Console/JSON/HTML).
 *
 * @param directory - Root directory to analyze
 * @param options - CLI options including focus area, max depth, and output format
 */
export async function contextActionHandler(directory: string, options: any) {
  console.log(chalk.blue('🔍 Analyzing context window costs...\n'));

  const startTime = Date.now();

  try {
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

    // Load and merge config with CLI options
    let finalOptions = await loadMergedConfig(directory, defaults, {
      maxDepth: options.maxDepth ? parseInt(options.maxDepth) : undefined,
      maxContextBudget: options.maxContext
        ? parseInt(options.maxContext)
        : undefined,
      minCohesion: options.minCohesion
        ? parseFloat(options.minCohesion)
        : undefined,
      maxFragmentation: options.maxFragmentation
        ? parseFloat(options.maxFragmentation)
        : undefined,
      focus:
        (options.focus as 'fragmentation' | 'cohesion' | 'depth' | 'all') ||
        undefined,
      includeNodeModules: options.includeNodeModules,
      include: options.include?.split(','),
      exclude: options.exclude?.split(','),
      maxResults: options.maxResults ? parseInt(options.maxResults) : undefined,
    });

    // Interactive setup if requested
    if (options.interactive) {
      finalOptions = await runInteractiveSetup(directory, finalOptions);
    }

    // Run analysis
    const results = await analyzeContext(finalOptions as any);
    const summary = generateSummary(results, finalOptions);

    const duration = getElapsedTime(startTime);

    // Handle output
    if (options.output === 'json') {
      handleJSONOutput(
        {
          summary: {
            ...summary,
            executionTime: duration,
            config: {
              scan: { tools: ['context'] },
              tools: { context: finalOptions },
            },
            toolConfigs: { context: finalOptions },
          },
          context: { results },
        },
        options.outputFile
      );
    } else if (options.output === 'html') {
      const html = generateHTMLReport(summary, results);
      const outputPath = resolveOutputPath(
        directory,
        options.outputFile,
        'context-report.html'
      );
      writeFileSync(outputPath, html, 'utf-8');
      console.log(chalk.green(`\n✅ HTML report saved to: ${outputPath}`));
    } else {
      // Default: Console
      displayConsoleReport(summary, results, finalOptions.maxResults);
      console.log(chalk.dim(`\n✨ Analysis completed in ${duration}ms\n`));
    }
  } catch (error) {
    handleCLIError(error, 'context-analyzer');
  }
}
