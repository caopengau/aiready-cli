#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeUnified, generateUnifiedSummary } from './index';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { 
  loadMergedConfig, 
  handleJSONOutput, 
  handleCLIError, 
  getElapsedTime, 
  resolveOutputPath,
  calculateOverallScore,
  formatScore,
  formatToolScore,
  getRatingDisplay,
  parseWeightString,
  type AIReadyConfig,
  type ToolScoringOutput,
} from '@aiready/core';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('aiready')
  .description('AIReady - Unified AI-readiness analysis tools')
  .version(packageJson.version)
  .addHelpText('after', '\nCONFIGURATION:\n  Supports config files: aiready.json, aiready.config.json, .aiready.json, .aireadyrc.json, aiready.config.js, .aireadyrc.js\n  CLI options override config file settings');

program
  .command('scan')
  .description('Run unified analysis on a codebase')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('-t, --tools <tools>', 'Tools to run (comma-separated: patterns,context,consistency)', 'patterns,context,consistency')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .option('--score', 'Calculate and display AI Readiness Score (0-100)')
  .option('--weights <weights>', 'Override tool weights for scoring (e.g., "patterns:50,context:30,consistency:20")')
  .option('--threshold <score>', 'Minimum passing score for CI/CD (exits with code 1 if below)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🚀 Starting AIReady unified analysis...\n'));

    const startTime = Date.now();

    try {
      // Define defaults
      const defaults = {
        tools: ['patterns', 'context', 'consistency'],
        include: undefined,
        exclude: undefined,
        output: {
          format: 'console',
          file: undefined,
        },
      };

      // Load and merge config with CLI options
      const baseOptions = await loadMergedConfig(directory, defaults, {
        tools: options.tools ? options.tools.split(',').map((t: string) => t.trim()) as ('patterns' | 'context' | 'consistency')[] : undefined,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      }) as any;

      // Apply smart defaults for pattern detection if patterns tool is enabled
      let finalOptions = { ...baseOptions };
      if (baseOptions.tools.includes('patterns')) {
        const { getSmartDefaults } = await import('@aiready/pattern-detect');
        const patternSmartDefaults = await getSmartDefaults(directory, baseOptions);
        finalOptions = { ...patternSmartDefaults, ...finalOptions };
      }

      const results = await analyzeUnified(finalOptions);

      const elapsedTime = getElapsedTime(startTime);

      // Calculate score if requested
      let scoringResult: ReturnType<typeof calculateOverallScore> | undefined;
      if (options.score || finalOptions.scoring?.showBreakdown) {
        const toolScores: Map<string, ToolScoringOutput> = new Map();
        
        // Collect scores from each tool that was run
        if (results.patterns && baseOptions.tools.includes('patterns')) {
          const { calculatePatternScore } = await import('@aiready/pattern-detect');
          const duplicates = results.patterns
            .flatMap(r => r.issues)
            .filter(i => i.type === 'duplicate-pattern');
          const score = calculatePatternScore(duplicates as any, results.patterns.length);
          toolScores.set('pattern-detect', score);
        }
        
        if (results.context && baseOptions.tools.includes('context')) {
          const { calculateContextScore } = await import('@aiready/context-analyzer');
          // Calculate summary from context results
          const summary = {
            avgContextBudget: results.context.reduce((sum, r) => sum + r.contextBudget, 0) / results.context.length,
            maxContextBudget: Math.max(...results.context.map(r => r.contextBudget)),
            avgImportDepth: results.context.reduce((sum, r) => sum + r.importDepth, 0) / results.context.length,
            maxImportDepth: Math.max(...results.context.map(r => r.importDepth)),
            avgFragmentation: results.context.reduce((sum, r) => sum + r.fragmentationScore, 0) / results.context.length,
            criticalIssues: results.context.filter(r => r.severity === 'critical').length,
            majorIssues: results.context.filter(r => r.severity === 'major').length,
          };
          const score = calculateContextScore(summary as any);
          toolScores.set('context-analyzer', score);
        }
        
        if (results.consistency && baseOptions.tools.includes('consistency')) {
          const { calculateConsistencyScore } = await import('@aiready/consistency');
          const issues = results.consistency.results?.flatMap((r: any) => r.issues) || [];
          const score = calculateConsistencyScore(issues, results.consistency.summary.filesAnalyzed);
          toolScores.set('consistency', score);
        }
        
        // Parse weight overrides from CLI
        const cliWeights = options.weights ? parseWeightString(options.weights) : undefined;
        
        // Calculate overall score
        scoringResult = calculateOverallScore(toolScores, finalOptions as AIReadyConfig, cliWeights);
        
        // Check threshold
        if (options.threshold) {
          const threshold = parseFloat(options.threshold);
          if (scoringResult.overall < threshold) {
            console.error(chalk.red(`\n❌ Score ${scoringResult.overall} is below threshold ${threshold}\n`));
            process.exit(1);
          }
        }
      }

      const outputFormat = options.output || finalOptions.output?.format || 'console';
      const userOutputFile = options.outputFile || finalOptions.output?.file;

      if (outputFormat === 'json') {
        const outputData = {
          ...results,
          summary: {
            ...results.summary,
            executionTime: parseFloat(elapsedTime),
          },
          ...(scoringResult && { scoring: scoringResult }),
        };

        const outputPath = resolveOutputPath(
          userOutputFile,
          `aiready-scan-${new Date().toISOString().split('T')[0]}.json`,
          directory
        );
        
        handleJSONOutput(outputData, outputPath, `✅ Results saved to ${outputPath}`);
      } else {
        // Console output
        console.log(generateUnifiedSummary(results));
        
        // Display score if calculated
        if (scoringResult) {
          const terminalWidth = process.stdout.columns || 80;
          const dividerWidth = Math.min(60, terminalWidth - 2);
          const divider = '━'.repeat(dividerWidth);
          
          console.log(chalk.cyan('\n' + divider));
          console.log(chalk.bold.white('  AI READINESS SCORE'));
          console.log(chalk.cyan(divider) + '\n');
          
          const { emoji, color } = getRatingDisplay(scoringResult.rating);
          const scoreColor = color === 'green' ? chalk.green : 
                            color === 'blue' ? chalk.blue : 
                            color === 'yellow' ? chalk.yellow : chalk.red;
          
          console.log(`  ${emoji} Overall Score: ${scoreColor.bold(scoringResult.overall + '/100')} (${chalk.bold(scoringResult.rating)})`);          console.log(`  ${chalk.dim('Timestamp:')} ${new Date(scoringResult.timestamp).toLocaleString()}\n`);
          
          // Show breakdown by tool
          if (scoringResult.breakdown.length > 0) {
            console.log(chalk.bold('  Component Scores:\n'));
            scoringResult.breakdown.forEach(tool => {
              const toolEmoji = tool.toolName === 'pattern-detect' ? '🔍' :
                              tool.toolName === 'context-analyzer' ? '🧠' : '🏷️';
              const weight = scoringResult.calculation.weights[tool.toolName];
              console.log(`  ${toolEmoji} ${chalk.white(tool.toolName.padEnd(20))} ${scoreColor(tool.score + '/100')} ${chalk.dim(`(weight: ${weight})`)}`);
            });
            console.log();
          }
          
          // Show calculation
          console.log(chalk.dim(`  Weighted Formula: ${scoringResult.calculation.formula}`));
          console.log(chalk.dim(`  Normalized Score: ${scoringResult.calculation.normalized}\n`));
          
          // Show top recommendations across all tools
          const allRecommendations = scoringResult.breakdown
            .flatMap(tool => tool.recommendations || [])
            .sort((a, b) => b.estimatedImpact - a.estimatedImpact)
            .slice(0, 5);
          
          if (allRecommendations.length > 0) {
            console.log(chalk.bold('  Top Recommendations:\n'));
            allRecommendations.forEach((rec, i) => {
              const priorityIcon = rec.priority === 'high' ? '🔴' : 
                                 rec.priority === 'medium' ? '🟡' : '🔵';
              console.log(`  ${i + 1}. ${priorityIcon} ${rec.action}`);
              console.log(`     ${chalk.dim(`Impact: +${rec.estimatedImpact} points`)}\n`);
            });
          }
        }
      }
    } catch (error) {
      handleCLIError(error, 'Analysis');
    }
  });

// Individual tool commands for convenience
program
  .command('patterns')
  .description('Run pattern detection analysis')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('-s, --similarity <number>', 'Minimum similarity score (0-1)', '0.40')
  .option('-l, --min-lines <number>', 'Minimum lines to consider', '5')
  .option('--max-candidates <number>', 'Maximum candidates per block (performance tuning)')
  .option('--min-shared-tokens <number>', 'Minimum shared tokens for candidates (performance tuning)')
  .option('--full-scan', 'Disable smart defaults for comprehensive analysis (slower)')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .option('--score', 'Calculate and display AI Readiness Score for patterns (0-100)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing patterns...\n'));

    const startTime = Date.now();

    try {
      // Determine if smart defaults should be used
      const useSmartDefaults = !options.fullScan;

      // Define defaults (only for options not handled by smart defaults)
      const defaults = {
        useSmartDefaults,
        include: undefined,
        exclude: undefined,
        output: {
          format: 'console',
          file: undefined,
        },
      };

      // Set fallback defaults only if smart defaults are disabled
      if (!useSmartDefaults) {
        (defaults as any).minSimilarity = 0.4;
        (defaults as any).minLines = 5;
      }

      // Load and merge config with CLI options
      const cliOptions: any = {
        minSimilarity: options.similarity ? parseFloat(options.similarity) : undefined,
        minLines: options.minLines ? parseInt(options.minLines) : undefined,
        useSmartDefaults,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      };

      // Only include performance tuning options if explicitly specified
      if (options.maxCandidates) {
        cliOptions.maxCandidatesPerBlock = parseInt(options.maxCandidates);
      }
      if (options.minSharedTokens) {
        cliOptions.minSharedTokens = parseInt(options.minSharedTokens);
      }

      const finalOptions = await loadMergedConfig(directory, defaults, cliOptions);

      const { analyzePatterns, generateSummary, calculatePatternScore } = await import('@aiready/pattern-detect');

      const { results, duplicates } = await analyzePatterns(finalOptions);

      const elapsedTime = getElapsedTime(startTime);
      const summary = generateSummary(results);
      
      // Calculate score if requested
      let patternScore: ToolScoringOutput | undefined;
      if (options.score) {
        patternScore = calculatePatternScore(duplicates, results.length);
      }

      const outputFormat = options.output || finalOptions.output?.format || 'console';
      const userOutputFile = options.outputFile || finalOptions.output?.file;

      if (outputFormat === 'json') {
        const outputData = {
          results,
          summary: { ...summary, executionTime: parseFloat(elapsedTime) },
          ...(patternScore && { scoring: patternScore }),
        };

        const outputPath = resolveOutputPath(
          userOutputFile,
          `pattern-report-${new Date().toISOString().split('T')[0]}.json`,
          directory
        );
        
        handleJSONOutput(outputData, outputPath, `✅ Results saved to ${outputPath}`);
      } else {
        // Console output - format to match standalone CLI
        const terminalWidth = process.stdout.columns || 80;
        const dividerWidth = Math.min(60, terminalWidth - 2);
        const divider = '━'.repeat(dividerWidth);
        
        console.log(chalk.cyan(divider));
        console.log(chalk.bold.white('  PATTERN ANALYSIS SUMMARY'));
        console.log(chalk.cyan(divider) + '\n');

        console.log(chalk.white(`📁 Files analyzed: ${chalk.bold(results.length)}`));
        console.log(chalk.yellow(`⚠  Duplicate patterns found: ${chalk.bold(summary.totalPatterns)}`));
        console.log(chalk.red(`💰 Token cost (wasted): ${chalk.bold(summary.totalTokenCost.toLocaleString())}`));
        console.log(chalk.gray(`⏱  Analysis time: ${chalk.bold(elapsedTime + 's')}`));

        // Show breakdown by pattern type
        const sortedTypes = Object.entries(summary.patternsByType || {})
          .filter(([, count]) => count > 0)
          .sort(([, a], [, b]) => (b as number) - (a as number));

        if (sortedTypes.length > 0) {
          console.log(chalk.cyan('\n' + divider));
          console.log(chalk.bold.white('  PATTERNS BY TYPE'));
          console.log(chalk.cyan(divider) + '\n');
          sortedTypes.forEach(([type, count]) => {
            console.log(`  ${chalk.white(type.padEnd(15))} ${chalk.bold(count)}`);
          });
        }

        // Show top duplicates
        if (summary.totalPatterns > 0 && duplicates.length > 0) {
          console.log(chalk.cyan('\n' + divider));
          console.log(chalk.bold.white('  TOP DUPLICATE PATTERNS'));
          console.log(chalk.cyan(divider) + '\n');

          // Sort by similarity and take top 10
          const topDuplicates = [...duplicates]
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 10);

          topDuplicates.forEach((dup) => {
            const severity = dup.similarity > 0.95 ? 'CRITICAL' : dup.similarity > 0.9 ? 'HIGH' : 'MEDIUM';
            const severityIcon = dup.similarity > 0.95 ? '🔴' : dup.similarity > 0.9 ? '🟡' : '🔵';
            const file1Name = dup.file1.split('/').pop() || dup.file1;
            const file2Name = dup.file2.split('/').pop() || dup.file2;
            console.log(`${severityIcon} ${severity}: ${chalk.bold(file1Name)} ↔ ${chalk.bold(file2Name)}`);
            console.log(`   Similarity: ${chalk.bold(Math.round(dup.similarity * 100) + '%')} | Wasted: ${chalk.bold(dup.tokenCost.toLocaleString())} tokens each`);
            console.log(`   Lines: ${chalk.cyan(dup.line1 + '-' + dup.endLine1)} ↔ ${chalk.cyan(dup.line2 + '-' + dup.endLine2)}\n`);
          });
        } else {
          console.log(chalk.green('\n✨ Great! No duplicate patterns detected.\n'));
        }
        
        // Display score if calculated
        if (patternScore) {
          console.log(chalk.cyan(divider));
          console.log(chalk.bold.white('  AI READINESS SCORE (Patterns)'));
          console.log(chalk.cyan(divider) + '\n');
          console.log(formatToolScore(patternScore));
          console.log();
        }
      }
    } catch (error) {
      handleCLIError(error, 'Pattern analysis');
    }
  });

program
  .command('context')
  .description('Run context window cost analysis')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('--max-depth <number>', 'Maximum acceptable import depth', '5')
  .option('--max-context <number>', 'Maximum acceptable context budget (tokens)', '10000')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .option('--score', 'Calculate and display AI Readiness Score for context (0-100)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🧠 Analyzing context costs...\n'));

    const startTime = Date.now();

    try {
      // Define defaults
      const defaults = {
        maxDepth: 5,
        maxContextBudget: 10000,
        include: undefined,
        exclude: undefined,
        output: {
          format: 'console',
          file: undefined,
        },
      };

      // Load and merge config with CLI options
      let baseOptions = await loadMergedConfig(directory, defaults, {
        maxDepth: options.maxDepth ? parseInt(options.maxDepth) : undefined,
        maxContextBudget: options.maxContext ? parseInt(options.maxContext) : undefined,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      });

      // Apply smart defaults for context analysis (always for individual context command)
      let finalOptions: any = { ...baseOptions };
      const { getSmartDefaults } = await import('@aiready/context-analyzer');
      const contextSmartDefaults = await getSmartDefaults(directory, baseOptions);
      finalOptions = { ...contextSmartDefaults, ...finalOptions };
      
      // Display configuration
      console.log('📋 Configuration:');
      console.log(`   Max depth: ${finalOptions.maxDepth}`);
      console.log(`   Max context budget: ${finalOptions.maxContextBudget}`);
      console.log(`   Min cohesion: ${(finalOptions.minCohesion * 100).toFixed(1)}%`);
      console.log(`   Max fragmentation: ${(finalOptions.maxFragmentation * 100).toFixed(1)}%`);
      console.log(`   Analysis focus: ${finalOptions.focus}`);
      console.log('');

      const { analyzeContext, generateSummary, calculateContextScore } = await import('@aiready/context-analyzer');

      const results = await analyzeContext(finalOptions);

      const elapsedTime = getElapsedTime(startTime);
      const summary = generateSummary(results);
      
      // Calculate score if requested
      let contextScore: ToolScoringOutput | undefined;
      if (options.score) {
        contextScore = calculateContextScore(summary as any);
      }

      const outputFormat = options.output || finalOptions.output?.format || 'console';
      const userOutputFile = options.outputFile || finalOptions.output?.file;

      if (outputFormat === 'json') {
        const outputData = {
          results,
          summary: { ...summary, executionTime: parseFloat(elapsedTime) },
          ...(contextScore && { scoring: contextScore }),
        };

        const outputPath = resolveOutputPath(
          userOutputFile,
          `context-report-${new Date().toISOString().split('T')[0]}.json`,
          directory
        );
        
        handleJSONOutput(outputData, outputPath, `✅ Results saved to ${outputPath}`);
      } else {
        // Console output - format the results nicely
        const terminalWidth = process.stdout.columns || 80;
        const dividerWidth = Math.min(60, terminalWidth - 2);
        const divider = '━'.repeat(dividerWidth);

        console.log(chalk.cyan(divider));
        console.log(chalk.bold.white('  CONTEXT ANALYSIS SUMMARY'));
        console.log(chalk.cyan(divider) + '\n');

        console.log(chalk.white(`📁 Files analyzed: ${chalk.bold(summary.totalFiles)}`));
        console.log(chalk.white(`📊 Total tokens: ${chalk.bold(summary.totalTokens.toLocaleString())}`));
        console.log(chalk.yellow(`💰 Avg context budget: ${chalk.bold(summary.avgContextBudget.toFixed(0))} tokens/file`));
        console.log(chalk.white(`⏱  Analysis time: ${chalk.bold(elapsedTime + 's')}\n`));

        // Issues summary
        const totalIssues = summary.criticalIssues + summary.majorIssues + summary.minorIssues;
        if (totalIssues > 0) {
          console.log(chalk.bold('⚠️  Issues Found:\n'));
          if (summary.criticalIssues > 0) {
            console.log(chalk.red(`   🔴 Critical: ${chalk.bold(summary.criticalIssues)}`));
          }
          if (summary.majorIssues > 0) {
            console.log(chalk.yellow(`   🟡 Major: ${chalk.bold(summary.majorIssues)}`));
          }
          if (summary.minorIssues > 0) {
            console.log(chalk.blue(`   🔵 Minor: ${chalk.bold(summary.minorIssues)}`));
          }
          console.log(chalk.green(`\n   💡 Potential savings: ${chalk.bold(summary.totalPotentialSavings.toLocaleString())} tokens\n`));
        } else {
          console.log(chalk.green('✅ No significant issues found!\n'));
        }

        // Deep import chains
        if (summary.deepFiles.length > 0) {
          console.log(chalk.bold('📏 Deep Import Chains:\n'));
          console.log(chalk.gray(`   Average depth: ${summary.avgImportDepth.toFixed(1)}`));
          console.log(chalk.gray(`   Maximum depth: ${summary.maxImportDepth}\n`));
          summary.deepFiles.slice(0, 10).forEach((item) => {
            const fileName = item.file.split('/').slice(-2).join('/');
            console.log(`   ${chalk.cyan('→')} ${chalk.white(fileName)} ${chalk.dim(`(depth: ${item.depth})`)}`);
          });
          console.log();
        }

        // Fragmented modules
        if (summary.fragmentedModules.length > 0) {
          console.log(chalk.bold('🧩 Fragmented Modules:\n'));
          console.log(chalk.gray(`   Average fragmentation: ${(summary.avgFragmentation * 100).toFixed(0)}%\n`));
          summary.fragmentedModules.slice(0, 10).forEach((module) => {
            console.log(`   ${chalk.yellow('●')} ${chalk.white(module.domain)} - ${chalk.dim(`${module.files.length} files, ${(module.fragmentationScore * 100).toFixed(0)}% scattered`)}`);
            console.log(chalk.dim(`     Token cost: ${module.totalTokens.toLocaleString()}, Cohesion: ${(module.avgCohesion * 100).toFixed(0)}%`));
          });
          console.log();
        }

        // Low cohesion files
        if (summary.lowCohesionFiles.length > 0) {
          console.log(chalk.bold('🔀 Low Cohesion Files:\n'));
          console.log(chalk.gray(`   Average cohesion: ${(summary.avgCohesion * 100).toFixed(0)}%\n`));
          summary.lowCohesionFiles.slice(0, 10).forEach((item) => {
            const fileName = item.file.split('/').slice(-2).join('/');
            const scorePercent = (item.score * 100).toFixed(0);
            const color = item.score < 0.4 ? chalk.red : chalk.yellow;
            console.log(`   ${color('○')} ${chalk.white(fileName)} ${chalk.dim(`(${scorePercent}% cohesion)`)}`);
          });
          console.log();
        }

        // Top expensive files
        if (summary.topExpensiveFiles.length > 0) {
          console.log(chalk.bold('💸 Most Expensive Files (Context Budget):\n'));
          summary.topExpensiveFiles.slice(0, 10).forEach((item) => {
            const fileName = item.file.split('/').slice(-2).join('/');
            const severityColor = item.severity === 'critical' ? chalk.red : item.severity === 'major' ? chalk.yellow : chalk.blue;
            console.log(`   ${severityColor('●')} ${chalk.white(fileName)} ${chalk.dim(`(${item.contextBudget.toLocaleString()} tokens)`)}`);
          });
          console.log();
        }
        
        // Display score if calculated
        if (contextScore) {
          console.log(chalk.cyan(divider));
          console.log(chalk.bold.white('  AI READINESS SCORE (Context)'));
          console.log(chalk.cyan(divider) + '\n');
          console.log(formatToolScore(contextScore));
          console.log();
        }
      }
    } catch (error) {
      handleCLIError(error, 'Context analysis');
    }
  });

  program
    .command('consistency')
    .description('Check naming, patterns, and architecture consistency')
    .argument('[directory]', 'Directory to analyze', '.')
    .option('--naming', 'Check naming conventions (default: true)')
    .option('--no-naming', 'Skip naming analysis')
    .option('--patterns', 'Check code patterns (default: true)')
    .option('--no-patterns', 'Skip pattern analysis')
    .option('--min-severity <level>', 'Minimum severity: info|minor|major|critical', 'info')
    .option('--include <patterns>', 'File patterns to include (comma-separated)')
    .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
    .option('-o, --output <format>', 'Output format: console, json, markdown', 'console')
    .option('--output-file <path>', 'Output file path (for json/markdown)')
    .option('--score', 'Calculate and display AI Readiness Score for consistency (0-100)')
    .action(async (directory, options) => {
      console.log(chalk.blue('🔍 Analyzing consistency...\n'));

      const startTime = Date.now();

      try {
        // Define defaults
        const defaults = {
          checkNaming: true,
          checkPatterns: true,
          minSeverity: 'info' as const,
          include: undefined,
          exclude: undefined,
          output: {
            format: 'console',
            file: undefined,
          },
        };

        // Load and merge config with CLI options
        const finalOptions = await loadMergedConfig(directory, defaults, {
          checkNaming: options.naming !== false,
          checkPatterns: options.patterns !== false,
          minSeverity: options.minSeverity,
          include: options.include?.split(','),
          exclude: options.exclude?.split(','),
        });

        const { analyzeConsistency, calculateConsistencyScore } = await import('@aiready/consistency');

        const report = await analyzeConsistency(finalOptions);

        const elapsedTime = getElapsedTime(startTime);
        
        // Calculate score if requested
        let consistencyScore: ToolScoringOutput | undefined;
        if (options.score) {
          const issues = report.results?.flatMap((r: any) => r.issues) || [];
          consistencyScore = calculateConsistencyScore(issues, report.summary.filesAnalyzed);
        }

        const outputFormat = options.output || finalOptions.output?.format || 'console';
        const userOutputFile = options.outputFile || finalOptions.output?.file;

        if (outputFormat === 'json') {
          const outputData = {
            ...report,
            summary: {
              ...report.summary,
              executionTime: parseFloat(elapsedTime),
            },
            ...(consistencyScore && { scoring: consistencyScore }),
          };

          const outputPath = resolveOutputPath(
            userOutputFile,
            `consistency-report-${new Date().toISOString().split('T')[0]}.json`,
            directory
          );
          
          handleJSONOutput(outputData, outputPath, `✅ Results saved to ${outputPath}`);
        } else if (outputFormat === 'markdown') {
          // Markdown output
          const markdown = generateMarkdownReport(report, elapsedTime);
          const outputPath = resolveOutputPath(
            userOutputFile,
            `consistency-report-${new Date().toISOString().split('T')[0]}.md`,
            directory
          );
          writeFileSync(outputPath, markdown);
          console.log(chalk.green(`✅ Report saved to ${outputPath}`));
        } else {
          // Console output - format to match standalone CLI
          console.log(chalk.bold('\n📊 Summary\n'));
          console.log(`Files Analyzed: ${chalk.cyan(report.summary.filesAnalyzed)}`);
          console.log(`Total Issues: ${chalk.yellow(report.summary.totalIssues)}`);
          console.log(`  Naming: ${chalk.yellow(report.summary.namingIssues)}`);
          console.log(`  Patterns: ${chalk.yellow(report.summary.patternIssues)}`);
          console.log(`  Architecture: ${chalk.yellow(report.summary.architectureIssues || 0)}`);
          console.log(`Analysis Time: ${chalk.gray(elapsedTime + 's')}\n`);

          if (report.summary.totalIssues === 0) {
            console.log(chalk.green('✨ No consistency issues found! Your codebase is well-maintained.\n'));
          } else {
            // Group and display issues by category
            const namingResults = report.results.filter((r: any) =>
              r.issues.some((i: any) => i.category === 'naming')
            );
            const patternResults = report.results.filter((r: any) =>
              r.issues.some((i: any) => i.category === 'patterns')
            );

            if (namingResults.length > 0) {
              console.log(chalk.bold('🏷️  Naming Issues\n'));
              let shown = 0;
              for (const result of namingResults) {
                if (shown >= 5) break;
                for (const issue of result.issues) {
                  if (shown >= 5) break;
                  const severityColor = issue.severity === 'critical' ? chalk.red :
                    issue.severity === 'major' ? chalk.yellow :
                    issue.severity === 'minor' ? chalk.blue : chalk.gray;
                  console.log(`${severityColor(issue.severity.toUpperCase())} ${chalk.dim(`${issue.location.file}:${issue.location.line}`)}`);
                  console.log(`  ${issue.message}`);
                  if (issue.suggestion) {
                    console.log(`  ${chalk.dim('→')} ${chalk.italic(issue.suggestion)}`);
                  }
                  console.log();
                  shown++;
                }
              }
              const remaining = namingResults.reduce((sum, r) => sum + r.issues.length, 0) - shown;
              if (remaining > 0) {
                console.log(chalk.dim(`  ... and ${remaining} more issues\n`));
              }
            }

            if (patternResults.length > 0) {
              console.log(chalk.bold('🔄 Pattern Issues\n'));
              let shown = 0;
              for (const result of patternResults) {
                if (shown >= 5) break;
                for (const issue of result.issues) {
                  if (shown >= 5) break;
                  const severityColor = issue.severity === 'critical' ? chalk.red :
                    issue.severity === 'major' ? chalk.yellow :
                    issue.severity === 'minor' ? chalk.blue : chalk.gray;
                  console.log(`${severityColor(issue.severity.toUpperCase())} ${chalk.dim(`${issue.location.file}:${issue.location.line}`)}`);
                  console.log(`  ${issue.message}`);
                  if (issue.suggestion) {
                    console.log(`  ${chalk.dim('→')} ${chalk.italic(issue.suggestion)}`);
                  }
                  console.log();
                  shown++;
                }
              }
              const remaining = patternResults.reduce((sum, r) => sum + r.issues.length, 0) - shown;
              if (remaining > 0) {
                console.log(chalk.dim(`  ... and ${remaining} more issues\n`));
              }
            }

            if (report.recommendations.length > 0) {
              console.log(chalk.bold('💡 Recommendations\n'));
              report.recommendations.forEach((rec: string, i: number) => {
                console.log(`${i + 1}. ${rec}`);
              });
              console.log();
            }
          }
          
          // Display score if calculated
          if (consistencyScore) {
            console.log(chalk.bold('\n📊 AI Readiness Score (Consistency)\n'));
            console.log(formatToolScore(consistencyScore));
            console.log();
          }
        }
      } catch (error) {
        handleCLIError(error, 'Consistency analysis');
      }
    });

  function generateMarkdownReport(report: any, elapsedTime: string): string {
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

program.parse();