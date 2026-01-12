#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeUnified, generateUnifiedSummary } from './index';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .name('aiready')
  .description('AIReady - Unified AI-readiness analysis tools')
  .version('0.1.0');

program
  .command('scan')
  .description('Run unified analysis on a codebase')
  .argument('<directory>', 'Directory to analyze')
  .option('-t, --tools <tools>', 'Tools to run (comma-separated: patterns,context)', 'patterns,context')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🚀 Starting AIReady unified analysis...\n'));

    const startTime = Date.now();

    try {
      const tools = options.tools.split(',').map((t: string) => t.trim()) as ('patterns' | 'context')[];

      const results = await analyzeUnified({
        rootDir: directory,
        tools,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      });

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (options.output === 'json') {
        const outputData = {
          ...results,
          summary: {
            ...results.summary,
            executionTime: parseFloat(elapsedTime),
          },
        };

        if (options.outputFile) {
          writeFileSync(options.outputFile, JSON.stringify(outputData, null, 2));
          console.log(chalk.green(`✅ Results saved to ${options.outputFile}`));
        } else {
          console.log(JSON.stringify(outputData, null, 2));
        }
      } else {
        // Console output
        console.log(generateUnifiedSummary(results));
      }
    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error);
      process.exit(1);
    }
  });

// Individual tool commands for convenience
program
  .command('patterns')
  .description('Run pattern detection analysis')
  .argument('<directory>', 'Directory to analyze')
  .option('-s, --similarity <number>', 'Minimum similarity score (0-1)', '0.40')
  .option('-l, --min-lines <number>', 'Minimum lines to consider', '5')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing patterns...\n'));

    const startTime = Date.now();

    try {
      const { analyzePatterns, generateSummary } = await import('@aiready/pattern-detect');

      const results = await analyzePatterns({
        rootDir: directory,
        minSimilarity: parseFloat(options.similarity),
        minLines: parseInt(options.minLines),
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      });

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const summary = generateSummary(results);

      if (options.output === 'json') {
        const outputData = {
          results,
          summary: { ...summary, executionTime: parseFloat(elapsedTime) },
        };

        if (options.outputFile) {
          writeFileSync(options.outputFile, JSON.stringify(outputData, null, 2));
          console.log(chalk.green(`✅ Results saved to ${options.outputFile}`));
        } else {
          console.log(JSON.stringify(outputData, null, 2));
        }
      } else {
        console.log(`Pattern Analysis Complete (${elapsedTime}s)`);
        console.log(`Found ${summary.totalPatterns} duplicate patterns`);
        console.log(`Total token cost: ${summary.totalTokenCost} tokens`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Pattern analysis failed:'), error);
      process.exit(1);
    }
  });

program
  .command('context')
  .description('Run context window cost analysis')
  .argument('<directory>', 'Directory to analyze')
  .option('--max-depth <number>', 'Maximum acceptable import depth', '5')
  .option('--max-context <number>', 'Maximum acceptable context budget (tokens)', '10000')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🧠 Analyzing context costs...\n'));

    const startTime = Date.now();

    try {
      const { analyzeContext, generateSummary } = await import('@aiready/context-analyzer');

      const results = await analyzeContext({
        rootDir: directory,
        maxDepth: parseInt(options.maxDepth),
        maxContextBudget: parseInt(options.maxContext),
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      });

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const summary = generateSummary(results);

      if (options.output === 'json') {
        const outputData = {
          results,
          summary: { ...summary, executionTime: parseFloat(elapsedTime) },
        };

        if (options.outputFile) {
          writeFileSync(options.outputFile, JSON.stringify(outputData, null, 2));
          console.log(chalk.green(`✅ Results saved to ${options.outputFile}`));
        } else {
          console.log(JSON.stringify(outputData, null, 2));
        }
      } else {
        console.log(`Context Analysis Complete (${elapsedTime}s)`);
        console.log(`Files analyzed: ${summary.totalFiles}`);
        console.log(`Issues found: ${results.length}`);
        console.log(`Average cohesion: ${(summary.avgCohesion * 100).toFixed(1)}%`);
        console.log(`Average fragmentation: ${(summary.avgFragmentation * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Context analysis failed:'), error);
      process.exit(1);
    }
  });

program.parse();