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
  getRating,
  getRatingDisplay,
  parseWeightString,
  type AIReadyConfig,
  type ToolScoringOutput,
} from '@aiready/core';
import { readFileSync, existsSync, copyFileSync } from 'fs';
import { resolve as resolvePath } from 'path';
import { GraphBuilder } from '@aiready/visualizer/graph';
import type { GraphData } from '@aiready/visualizer';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('aiready')
  .description('AIReady - Assess and improve AI-readiness of codebases')
  .version(packageJson.version)
  .addHelpText('after', `
AI READINESS SCORING:
  Get a 0-100 score indicating how AI-ready your codebase is.
  Use --score flag with any analysis command for detailed breakdown.

EXAMPLES:
  $ aiready scan                          # Quick analysis of current directory
  $ aiready scan --score                  # Get AI Readiness Score (0-100)
  $ aiready scan --tools patterns         # Run only pattern detection
  $ aiready patterns --similarity 0.6     # Custom similarity threshold
  $ aiready scan --output json --output-file results.json

GETTING STARTED:
  1. Run 'aiready scan' to analyze your codebase
  2. Use 'aiready scan --score' for AI readiness assessment
  3. Create aiready.json for persistent configuration
  4. Set up CI/CD with '--threshold' for quality gates

CONFIGURATION:
  Config files (searched upward): aiready.json, .aiready.json, aiready.config.*
  CLI options override config file settings

  Example aiready.json:
  {
    "scan": { "exclude": ["**/dist/**", "**/node_modules/**"] },
    "tools": {
      "pattern-detect": { "minSimilarity": 0.5 },
      "context-analyzer": { "maxContextBudget": 15000 }
    },
    "output": { "format": "json", "directory": ".aiready" }
  }

VERSION: ${packageJson.version}
DOCUMENTATION: https://aiready.dev/docs/cli
GITHUB: https://github.com/caopengau/aiready-cli
LANDING: https://github.com/caopengau/aiready-landing`);

program
  .command('scan')
  .description('Run comprehensive AI-readiness analysis (patterns + context + consistency)')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('-t, --tools <tools>', 'Tools to run (comma-separated: patterns,context,consistency)', 'patterns,context,consistency')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'json')
  .option('--output-file <path>', 'Output file path (for json)')
  .option('--no-score', 'Disable calculating AI Readiness Score (enabled by default)')
  .option('--weights <weights>', 'Custom scoring weights (patterns:40,context:35,consistency:25)')
  .option('--threshold <score>', 'Fail CI/CD if score below threshold (0-100)')
  .addHelpText('after', `
EXAMPLES:
  $ aiready scan                                    # Analyze all tools
  $ aiready scan --tools patterns,context           # Skip consistency
  $ aiready scan --score --threshold 75             # CI/CD with threshold
  $ aiready scan --output json --output-file report.json
`)
  .action(async (directory, options) => {
    console.log(chalk.blue('🚀 Starting AIReady unified analysis...\n'));

    const startTime = Date.now();
    // Resolve directory to absolute path to ensure .aiready/ is created in the right location
    const resolvedDir = resolvePath(process.cwd(), directory || '.');

    try {
      // Define defaults
      const defaults = {
        tools: ['patterns', 'context', 'consistency'],
        include: undefined,
        exclude: undefined,
        output: {
          format: 'json',
          file: undefined,
        },
      };

      // Load and merge config with CLI options
      const baseOptions = await loadMergedConfig(resolvedDir, defaults, {
        tools: options.tools ? options.tools.split(',').map((t: string) => t.trim()) as ('patterns' | 'context' | 'consistency')[] : undefined,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      }) as any;


      // Apply smart defaults for pattern detection if patterns tool is enabled
      let finalOptions = { ...baseOptions };
      if (baseOptions.tools.includes('patterns')) {
        const { getSmartDefaults } = await import('@aiready/pattern-detect');
        const patternSmartDefaults = await getSmartDefaults(resolvedDir, baseOptions);
        // Merge deeply to preserve nested config
        finalOptions = { ...patternSmartDefaults, ...finalOptions, ...baseOptions };
      }

      // Print pre-run summary with expanded settings (truncate long arrays)
      console.log(chalk.cyan('\n=== AIReady Run Preview ==='));
      console.log(chalk.white('Tools to run:'), (finalOptions.tools || ['patterns', 'context', 'consistency']).join(', '));
      console.log(chalk.white('Will use settings from config and defaults.'));

      const truncate = (arr: any[] | undefined, cap = 8) => {
        if (!Array.isArray(arr)) return '';
        const shown = arr.slice(0, cap).map((v) => String(v));
        const more = arr.length - shown.length;
        return shown.join(', ') + (more > 0 ? `, ... (+${more} more)` : '');
      };

      // Common top-level settings
      console.log(chalk.white('\nGeneral settings:'));
      if (finalOptions.rootDir) console.log(`  rootDir: ${chalk.bold(String(finalOptions.rootDir))}`);
      if (finalOptions.include) console.log(`  include: ${chalk.bold(truncate(finalOptions.include, 6))}`);
      if (finalOptions.exclude) console.log(`  exclude: ${chalk.bold(truncate(finalOptions.exclude, 6))}`);

      if (finalOptions['pattern-detect'] || finalOptions.minSimilarity) {
        const patternDetectConfig = finalOptions['pattern-detect'] || {
          minSimilarity: finalOptions.minSimilarity,
          minLines: finalOptions.minLines,
          approx: finalOptions.approx,
          minSharedTokens: finalOptions.minSharedTokens,
          maxCandidatesPerBlock: finalOptions.maxCandidatesPerBlock,
          batchSize: finalOptions.batchSize,
          streamResults: finalOptions.streamResults,
          severity: (finalOptions as any).severity,
          includeTests: (finalOptions as any).includeTests,
        };
        console.log(chalk.white('\nPattern-detect settings:'));
        console.log(`  minSimilarity: ${chalk.bold(patternDetectConfig.minSimilarity ?? 'default')}`);
        console.log(`  minLines: ${chalk.bold(patternDetectConfig.minLines ?? 'default')}`);
        if (patternDetectConfig.approx !== undefined) console.log(`  approx: ${chalk.bold(String(patternDetectConfig.approx))}`);
        if (patternDetectConfig.minSharedTokens !== undefined) console.log(`  minSharedTokens: ${chalk.bold(String(patternDetectConfig.minSharedTokens))}`);
        if (patternDetectConfig.maxCandidatesPerBlock !== undefined) console.log(`  maxCandidatesPerBlock: ${chalk.bold(String(patternDetectConfig.maxCandidatesPerBlock))}`);
        if (patternDetectConfig.batchSize !== undefined) console.log(`  batchSize: ${chalk.bold(String(patternDetectConfig.batchSize))}`);
        if (patternDetectConfig.streamResults !== undefined) console.log(`  streamResults: ${chalk.bold(String(patternDetectConfig.streamResults))}`);
        if (patternDetectConfig.severity !== undefined) console.log(`  severity: ${chalk.bold(String(patternDetectConfig.severity))}`);
        if (patternDetectConfig.includeTests !== undefined) console.log(`  includeTests: ${chalk.bold(String(patternDetectConfig.includeTests))}`);
      }

      if (finalOptions['context-analyzer'] || finalOptions.maxDepth) {
        const ca = finalOptions['context-analyzer'] || {
          maxDepth: finalOptions.maxDepth,
          maxContextBudget: finalOptions.maxContextBudget,
          minCohesion: (finalOptions as any).minCohesion,
          maxFragmentation: (finalOptions as any).maxFragmentation,
          includeNodeModules: (finalOptions as any).includeNodeModules,
        };
        console.log(chalk.white('\nContext-analyzer settings:'));
        console.log(`  maxDepth: ${chalk.bold(ca.maxDepth ?? 'default')}`);
        console.log(`  maxContextBudget: ${chalk.bold(ca.maxContextBudget ?? 'default')}`);
        if (ca.minCohesion !== undefined) console.log(`  minCohesion: ${chalk.bold(String(ca.minCohesion))}`);
        if (ca.maxFragmentation !== undefined) console.log(`  maxFragmentation: ${chalk.bold(String(ca.maxFragmentation))}`);
        if (ca.includeNodeModules !== undefined) console.log(`  includeNodeModules: ${chalk.bold(String(ca.includeNodeModules))}`);
      }

      if (finalOptions.consistency) {
        const c = finalOptions.consistency;
        console.log(chalk.white('\nConsistency settings:'));
        console.log(`  checkNaming: ${chalk.bold(String(c.checkNaming ?? true))}`);
        console.log(`  checkPatterns: ${chalk.bold(String(c.checkPatterns ?? true))}`);
        console.log(`  checkArchitecture: ${chalk.bold(String(c.checkArchitecture ?? false))}`);
        if (c.minSeverity) console.log(`  minSeverity: ${chalk.bold(c.minSeverity)}`);
        if (c.acceptedAbbreviations) console.log(`  acceptedAbbreviations: ${chalk.bold(truncate(c.acceptedAbbreviations, 8))}`);
        if (c.shortWords) console.log(`  shortWords: ${chalk.bold(truncate(c.shortWords, 8))}`);
      }

      console.log(chalk.white('\nStarting analysis...'));

      // Progress callback to surface per-tool output as each tool finishes
      const progressCallback = (event: { tool: string; data: any }) => {
        console.log(chalk.cyan(`\n--- ${event.tool.toUpperCase()} RESULTS ---`));
        try {
          if (event.tool === 'patterns') {
            const pr = event.data as any;
            console.log(`  Duplicate patterns: ${chalk.bold(String(pr.duplicates?.length || 0))}`);
            console.log(`  Files with pattern issues: ${chalk.bold(String(pr.results?.length || 0))}`);
            // show top duplicate summaries
            if (pr.duplicates && pr.duplicates.length > 0) {
              pr.duplicates.slice(0, 5).forEach((d: any, i: number) => {
                console.log(`   ${i + 1}. ${d.file1.split('/').pop()} ↔ ${d.file2.split('/').pop()} (sim=${(d.similarity * 100).toFixed(1)}%)`);
              });
            }

            // show top files with pattern issues (sorted by issue count desc)
            if (pr.results && pr.results.length > 0) {
              console.log(`  Top files with pattern issues:`);
              const sortedByIssues = [...pr.results].sort((a: any, b: any) => (b.issues?.length || 0) - (a.issues?.length || 0));
              sortedByIssues.slice(0, 5).forEach((r: any, i: number) => {
                console.log(`   ${i + 1}. ${r.fileName.split('/').pop()} - ${r.issues.length} issue(s)`);
              });
            }

            // Grouping and clusters summary (if available) — show after detailed findings
            if (pr.groups && pr.groups.length >= 0) {
              console.log(`  ✅ Grouped ${chalk.bold(String(pr.duplicates?.length || 0))} duplicates into ${chalk.bold(String(pr.groups.length))} file pairs`);
            }
            if (pr.clusters && pr.clusters.length >= 0) {
              console.log(`  ✅ Created ${chalk.bold(String(pr.clusters.length))} refactor clusters`);
              // show brief cluster summaries
              pr.clusters.slice(0, 3).forEach((cl: any, idx: number) => {
                const files = (cl.files || []).map((f: any) => f.path.split('/').pop()).join(', ');
                console.log(`   ${idx + 1}. ${files} (${cl.tokenCost || 'n/a'} tokens)`);
              });
            }
          } else if (event.tool === 'context') {
            const cr = event.data as any[];
            console.log(`  Context issues found: ${chalk.bold(String(cr.length || 0))}`);
            cr.slice(0, 5).forEach((c: any, i: number) => {
              const msg = c.message ? ` - ${c.message}` : '';
              console.log(`   ${i + 1}. ${c.file} (${c.severity || 'n/a'})${msg}`);
            });
          } else if (event.tool === 'consistency') {
            const rep = event.data as any;
            console.log(`  Consistency totalIssues: ${chalk.bold(String(rep.summary?.totalIssues || 0))}`);

            if (rep.results && rep.results.length > 0) {
              // Group issues by file
              const fileMap = new Map<string, any[]>();
              rep.results.forEach((r: any) => {
                (r.issues || []).forEach((issue: any) => {
                  const file = issue.location?.file || r.file || 'unknown';
                  if (!fileMap.has(file)) fileMap.set(file, []);
                  fileMap.get(file)!.push(issue);
                });
              });

              // Sort files by number of issues desc
              const files = Array.from(fileMap.entries()).sort((a, b) => b[1].length - a[1].length);
              const topFiles = files.slice(0, 10);

              topFiles.forEach(([file, issues], idx) => {
                // Count severities
                const counts = issues.reduce((acc: any, it: any) => {
                  const s = (it.severity || 'info').toLowerCase();
                  acc[s] = (acc[s] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                const sample = issues.find((it: any) => it.severity === 'critical' || it.severity === 'major') || issues[0];
                const sampleMsg = sample ? ` — ${sample.message}` : '';

                console.log(`   ${idx + 1}. ${file} — ${issues.length} issue(s) (critical:${counts.critical||0} major:${counts.major||0} minor:${counts.minor||0} info:${counts.info||0})${sampleMsg}`);
              });

              const remaining = files.length - topFiles.length;
              if (remaining > 0) {
                console.log(chalk.dim(`   ... and ${remaining} more files with issues (use --output json for full details)`));
              }
            }
          }
        } catch (err) {
          // don't crash the run for progress printing errors
        }
      };

      const results = await analyzeUnified({ ...finalOptions, progressCallback, suppressToolConfig: true });

      // Summarize tools and results to console
      console.log(chalk.cyan('\n=== AIReady Run Summary ==='));
      console.log(chalk.white('Tools run:'), (finalOptions.tools || ['patterns', 'context', 'consistency']).join(', '));

      // Results summary
      console.log(chalk.cyan('\nResults summary:'));
      console.log(`  Total issues (all tools): ${chalk.bold(String(results.summary.totalIssues || 0))}`);
      if (results.duplicates) console.log(`  Duplicate patterns found: ${chalk.bold(String(results.duplicates.length || 0))}`);
      if (results.patterns) console.log(`  Pattern files with issues: ${chalk.bold(String(results.patterns.length || 0))}`);
      if (results.context) console.log(`  Context issues: ${chalk.bold(String(results.context.length || 0))}`);
      if (results.consistency) console.log(`  Consistency issues: ${chalk.bold(String(results.consistency.summary.totalIssues || 0))}`);
      console.log(chalk.cyan('===========================\n'));

      const elapsedTime = getElapsedTime(startTime);

      // Calculate score if requested: assemble per-tool scoring outputs
      let scoringResult: ReturnType<typeof calculateOverallScore> | undefined;
      if (options.score || finalOptions.scoring?.showBreakdown) {
        const toolScores: Map<string, ToolScoringOutput> = new Map();

        // Patterns score
        if (results.duplicates) {
          const { calculatePatternScore } = await import('@aiready/pattern-detect');
          try {
            const patternScore = calculatePatternScore(results.duplicates, results.patterns?.length || 0);
            toolScores.set('pattern-detect', patternScore);
          } catch (err) {
            // ignore scoring failures for a single tool
          }
        }

        // Context score
        if (results.context) {
          const { generateSummary: genContextSummary, calculateContextScore } = await import('@aiready/context-analyzer');
          try {
            const ctxSummary = genContextSummary(results.context);
            const contextScore = calculateContextScore(ctxSummary);
            toolScores.set('context-analyzer', contextScore);
          } catch (err) {
            // ignore
          }
        }

        // Consistency score
        if (results.consistency) {
          const { calculateConsistencyScore } = await import('@aiready/consistency');
          try {
            const issues = results.consistency.results?.flatMap((r: any) => r.issues) || [];
            const totalFiles = results.consistency.summary?.filesAnalyzed || 0;
            const consistencyScore = calculateConsistencyScore(issues, totalFiles);
            toolScores.set('consistency', consistencyScore);
          } catch (err) {
            // ignore
          }
        }

        // Parse CLI weight overrides (if any)
        const cliWeights = parseWeightString((options as any).weights);

        // Only calculate overall score if we have at least one tool score
        if (toolScores.size > 0) {
          scoringResult = calculateOverallScore(toolScores, finalOptions, cliWeights.size ? cliWeights : undefined);

          console.log(chalk.bold('\n📊 AI Readiness Overall Score'));
          console.log(`  ${formatScore(scoringResult)}`);

          // Show concise breakdown; detailed breakdown only if config requests it
          if (scoringResult.breakdown && scoringResult.breakdown.length > 0) {
            console.log(chalk.bold('\nTool breakdown:'));
            scoringResult.breakdown.forEach((tool) => {
              const rating = getRating(tool.score);
              const rd = getRatingDisplay(rating);
              console.log(`  - ${tool.toolName}: ${tool.score}/100 (${rating}) ${rd.emoji}`);
            });
            console.log();

            if (finalOptions.scoring?.showBreakdown) {
              console.log(chalk.bold('Detailed tool breakdown:'));
              scoringResult.breakdown.forEach((tool) => {
                console.log(formatToolScore(tool));
              });
              console.log();
            }
          }
        }
      }

      // Persist JSON summary when output format is json
      const outputFormat = options.output || finalOptions.output?.format || 'console';
      const userOutputFile = options.outputFile || finalOptions.output?.file;
      if (outputFormat === 'json') {
        const timestamp = getReportTimestamp();
        const defaultFilename = `aiready-report-${timestamp}.json`;
        const outputPath = resolveOutputPath(userOutputFile, defaultFilename, resolvedDir);
        const outputData = { ...results, scoring: scoringResult };
        handleJSONOutput(outputData, outputPath, `✅ Report saved to ${outputPath}`);
        
        // Warn if graph caps may be exceeded
        warnIfGraphCapExceeded(outputData, resolvedDir);
      }
    } catch (error) {
      handleCLIError(error, 'Analysis');
    }
  });

// Individual tool commands for convenience
program
  .command('patterns')
  .description('Detect duplicate code patterns that confuse AI models')
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
  .addHelpText('after', `
EXAMPLES:
  $ aiready patterns                                 # Default analysis
  $ aiready patterns --similarity 0.6               # Stricter matching
  $ aiready patterns --min-lines 10                 # Larger patterns only
`)
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing patterns...\n'));

    const startTime = Date.now();
    const resolvedDir = resolvePath(process.cwd(), directory || '.');

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

      const finalOptions = await loadMergedConfig(resolvedDir, defaults, cliOptions);

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
          `aiready-report-${getReportTimestamp()}.json`,
          resolvedDir
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
  .description('Analyze context window costs and dependency fragmentation')
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
    const resolvedDir = resolvePath(process.cwd(), directory || '.');

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
      let baseOptions = await loadMergedConfig(resolvedDir, defaults, {
        maxDepth: options.maxDepth ? parseInt(options.maxDepth) : undefined,
        maxContextBudget: options.maxContext ? parseInt(options.maxContext) : undefined,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      });

      // Apply smart defaults for context analysis (always for individual context command)
      let finalOptions: any = { ...baseOptions };
      const { getSmartDefaults } = await import('@aiready/context-analyzer');
      const contextSmartDefaults = await getSmartDefaults(resolvedDir, baseOptions);
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
          `aiready-report-${getReportTimestamp()}.json`,
          resolvedDir
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
    .description('Check naming conventions and architectural consistency')
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
      const resolvedDir = resolvePath(process.cwd(), directory || '.');

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
        const finalOptions = await loadMergedConfig(resolvedDir, defaults, {
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
            `aiready-report-${getReportTimestamp()}.json`,
            resolvedDir
          );
          
          handleJSONOutput(outputData, outputPath, `✅ Results saved to ${outputPath}`);
        } else if (outputFormat === 'markdown') {
          // Markdown output
          const markdown = generateMarkdownReport(report, elapsedTime);
          const outputPath = resolveOutputPath(
            userOutputFile,
            `aiready-report-${getReportTimestamp()}.md`,
            resolvedDir
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

  function generateHTML(graph: GraphData): string {
    const payload = JSON.stringify(graph, null, 2);
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AIReady Visualization</title>
    <style>
      html,body { height: 100%; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0 }
      #container { display:flex; height:100vh }
      #panel { width: 320px; padding: 16px; background: #071130; box-shadow: -2px 0 8px rgba(0,0,0,0.3); overflow:auto }
      #canvasWrap { flex:1; display:flex; align-items:center; justify-content:center }
      canvas { background: #0b1220; border-radius:8px }
      .stat { margin-bottom:12px }
    </style>
  </head>
  <body>
    <div id="container">
      <div id="canvasWrap"><canvas id="canvas" width="1200" height="800"></canvas></div>
      <div id="panel">
        <h2>AIReady Visualization</h2>
        <div class="stat"><strong>Files:</strong> <span id="stat-files"></span></div>
        <div class="stat"><strong>Dependencies:</strong> <span id="stat-deps"></span></div>
        <div class="stat"><strong>Legend</strong></div>
        <div style="font-size:13px;line-height:1.3;color:#cbd5e1;margin-top:8px">
          <div style="margin-bottom:8px"><span style="display:inline-block;width:12px;height:12px;background:#ff4d4f;margin-right:8px;border:1px solid rgba(255,255,255,0.06)"></span><strong>Critical</strong>: highest severity issues.</div>
          <div style="margin-bottom:8px"><span style="display:inline-block;width:12px;height:12px;background:#ff9900;margin-right:8px;border:1px solid rgba(255,255,255,0.06)"></span><strong>Major</strong>: important issues.</div>
          <div style="margin-bottom:8px"><span style="display:inline-block;width:12px;height:12px;background:#ffd666;margin-right:8px;border:1px solid rgba(255,255,255,0.06)"></span><strong>Minor</strong>: low priority issues.</div>
          <div style="margin-bottom:8px"><span style="display:inline-block;width:12px;height:12px;background:#91d5ff;margin-right:8px;border:1px solid rgba(255,255,255,0.06)"></span><strong>Info</strong>: informational notes.</div>
          <div style="margin-top:10px;color:#94a3b8"><strong>Node size</strong>: larger = higher token cost, more issues or dependency weight.</div>
          <div style="margin-top:6px;color:#94a3b8"><strong>Proximity</strong>: nodes that are spatially close are more contextually related; relatedness is represented by distance and size rather than explicit edges.</div>
          <div style="margin-top:6px;color:#94a3b8"><strong>Edge colors</strong>: <span style="color:#fb7e81">Similarity</span>, <span style="color:#84c1ff">Dependency</span>, <span style="color:#ffa500">Reference</span>, default <span style="color:#334155">Other</span>.</div>
        </div>
      </div>
    </div>

    <script>
      const graphData = ${payload};
      document.getElementById('stat-files').textContent = graphData.metadata.totalFiles;
      document.getElementById('stat-deps').textContent = graphData.metadata.totalDependencies;

      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');

      const nodes = graphData.nodes.map((n, i) => ({
        ...n,
        x: canvas.width / 2 + Math.cos(i / graphData.nodes.length * Math.PI * 2) * (Math.min(canvas.width, canvas.height) / 3),
        y: canvas.height / 2 + Math.sin(i / graphData.nodes.length * Math.PI * 2) * (Math.min(canvas.width, canvas.height) / 3),
      }));

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        graphData.edges.forEach(edge => {
          const s = nodes.find(n => n.id === edge.source);
          const t = nodes.find(n => n.id === edge.target);
          if (!s || !t) return;
          if (edge.type === 'related') return;
          if (edge.type === 'similarity') {
            ctx.strokeStyle = '#fb7e81';
            ctx.lineWidth = 1.2;
          } else if (edge.type === 'dependency') {
            ctx.strokeStyle = '#84c1ff';
            ctx.lineWidth = 1.0;
          } else if (edge.type === 'reference') {
            ctx.strokeStyle = '#ffa500';
            ctx.lineWidth = 0.9;
          } else {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 0.8;
          }
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        });

        const groups = {};
        nodes.forEach(n => {
          const g = n.group || '__default';
          if (!groups[g]) groups[g] = { minX: n.x, minY: n.y, maxX: n.x, maxY: n.y };
          groups[g].minX = Math.min(groups[g].minX, n.x);
          groups[g].minY = Math.min(groups[g].minY, n.y);
          groups[g].maxX = Math.max(groups[g].maxX, n.x);
          groups[g].maxY = Math.max(groups[g].maxY, n.y);
        });

        const groupRelations = {};
        graphData.edges.forEach(edge => {
          const sNode = nodes.find(n => n.id === edge.source);
          const tNode = nodes.find(n => n.id === edge.target);
          if (!sNode || !tNode) return;
          const g1 = sNode.group || '__default';
          const g2 = tNode.group || '__default';
          if (g1 === g2) return;
          const key = g1 < g2 ? g1 + '::' + g2 : g2 + '::' + g1;
          groupRelations[key] = (groupRelations[key] || 0) + 1;
        });

        Object.keys(groupRelations).forEach(k => {
          const count = groupRelations[k];
          const [ga, gb] = k.split('::');
          if (!groups[ga] || !groups[gb]) return;
          const ax = (groups[ga].minX + groups[ga].maxX) / 2;
          const ay = (groups[ga].minY + groups[ga].maxY) / 2;
          const bx = (groups[gb].minX + groups[gb].maxX) / 2;
          const by = (groups[gb].minY + groups[gb].maxY) / 2;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(148,163,184,0.25)';
          ctx.lineWidth = Math.min(6, 0.6 + Math.sqrt(count));
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        });

        Object.keys(groups).forEach(g => {
          if (g === '__default') return;
          const box = groups[g];
          const pad = 16;
          const x = box.minX - pad;
          const y = box.minY - pad;
          const w = (box.maxX - box.minX) + pad * 2;
          const h = (box.maxY - box.minY) + pad * 2;
          ctx.save();
          ctx.fillStyle = 'rgba(30,64,175,0.04)';
          ctx.strokeStyle = 'rgba(30,64,175,0.12)';
          ctx.lineWidth = 1.2;
          const r = 8;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = '#94a3b8';
          ctx.font = '11px sans-serif';
          ctx.fillText(g, x + 8, y + 14);
        });

        nodes.forEach(n => {
          const sizeVal = (n.size || n.value || 1);
          const r = 6 + (sizeVal / 2);
          ctx.beginPath();
          ctx.fillStyle = n.color || '#60a5fa';
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#e2e8f0';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(n.label || n.id.split('/').slice(-1)[0], n.x, n.y + r + 12);
        });
      }

      draw();
    </script>
  </body>
</html>`;
  }

  /**
   * Generate timestamp for report filenames (YYYYMMDD-HHMMSS)
   * Provides better granularity than date-only filenames
   */
  function getReportTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  /**
   * Find the latest aiready report in the .aiready directory
   * Searches for both new format (aiready-report-*) and legacy format (aiready-scan-*)
   */
  function findLatestScanReport(dirPath: string): string | null {
    const aireadyDir = resolvePath(dirPath, '.aiready');
    if (!existsSync(aireadyDir)) {
      return null;
    }
    
    const { readdirSync, statSync } = require('fs');
    // Search for new format first, then legacy format
    let files = readdirSync(aireadyDir).filter(f => f.startsWith('aiready-report-') && f.endsWith('.json'));
    if (files.length === 0) {
      files = readdirSync(aireadyDir).filter(f => f.startsWith('aiready-scan-') && f.endsWith('.json'));
    }
    
    if (files.length === 0) {
      return null;
    }
    
    // Sort by modification time, most recent first
    const sortedFiles = files
      .map(f => ({ name: f, path: resolvePath(aireadyDir, f), mtime: statSync(resolvePath(aireadyDir, f)).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    return sortedFiles[0].path;
  }

  function warnIfGraphCapExceeded(report: any, dirPath: string) {
    try {
      // Use dynamic import and loadConfig to get the raw visualizer config
      const { loadConfig } = require('@aiready/core');
      
      // Sync file system check since we can't easily call loadConfig synchronously
      const { existsSync, readFileSync } = require('fs');
      const { resolve } = require('path');
      
      let graphConfig = { maxNodes: 400, maxEdges: 600 };
      
      // Try to read aiready.json synchronously
      const configPath = resolve(dirPath, 'aiready.json');
      if (existsSync(configPath)) {
        try {
          const rawConfig = JSON.parse(readFileSync(configPath, 'utf8'));
          if (rawConfig.visualizer?.graph) {
            graphConfig = {
              maxNodes: rawConfig.visualizer.graph.maxNodes ?? graphConfig.maxNodes,
              maxEdges: rawConfig.visualizer.graph.maxEdges ?? graphConfig.maxEdges,
            };
          }
        } catch (e) {
          // Silently ignore parse errors and use defaults
        }
      }
      
      const nodeCount = (report.context?.length || 0) + (report.patterns?.length || 0);
      const edgeCount = report.context?.reduce((sum: number, ctx: any) => {
        const relCount = ctx.relatedFiles?.length || 0;
        const depCount = ctx.dependencies?.length || 0;
        return sum + relCount + depCount;
      }, 0) || 0;
      
      if (nodeCount > graphConfig.maxNodes || edgeCount > graphConfig.maxEdges) {
        console.log('');
        console.log(chalk.yellow(`⚠️  Graph may be truncated at visualization time:`));
        if (nodeCount > graphConfig.maxNodes) {
          console.log(chalk.dim(`   • Nodes: ${nodeCount} > limit ${graphConfig.maxNodes}`));
        }
        if (edgeCount > graphConfig.maxEdges) {
          console.log(chalk.dim(`   • Edges: ${edgeCount} > limit ${graphConfig.maxEdges}`));
        }
        console.log(chalk.dim(`   To increase limits, add to aiready.json:`));
        console.log(chalk.dim(`   {`));
        console.log(chalk.dim(`     "visualizer": {`));
        console.log(chalk.dim(`       "graph": { "maxNodes": 2000, "maxEdges": 5000 }`));
        console.log(chalk.dim(`     }`));
        console.log(chalk.dim(`   }`));
      }
    } catch (e) {
      // Silently fail on config read errors
    }
  }

  async function handleVisualize(directory: string | undefined, options: any) {
    try {
      const dirPath = resolvePath(process.cwd(), directory || '.');
      let reportPath = options.report ? resolvePath(dirPath, options.report) : null;
      
      // If report not provided or not found, try to find latest scan report
      if (!reportPath || !existsSync(reportPath)) {
        const latestScan = findLatestScanReport(dirPath);
        if (latestScan) {
          reportPath = latestScan;
          console.log(chalk.dim(`Found latest report: ${latestScan.split('/').pop()}`));
        } else {
          console.error(chalk.red('❌ No AI readiness report found'));
          console.log(chalk.dim(`\nGenerate a report with:\n  aiready scan --output json\n\nOr specify a custom report:\n  aiready visualise --report <path-to-report.json>`));
          return;
        }
      }

      const raw = readFileSync(reportPath, 'utf8');
      const report = JSON.parse(raw);

      // Load config to extract graph caps
      const configPath = resolvePath(dirPath, 'aiready.json');
      let graphConfig = { maxNodes: 400, maxEdges: 600 };
      
      if (existsSync(configPath)) {
        try {
          const rawConfig = JSON.parse(readFileSync(configPath, 'utf8'));
          if (rawConfig.visualizer?.graph) {
            graphConfig = {
              maxNodes: rawConfig.visualizer.graph.maxNodes ?? graphConfig.maxNodes,
              maxEdges: rawConfig.visualizer.graph.maxEdges ?? graphConfig.maxEdges,
            };
          }
        } catch (e) {
          // Silently ignore parse errors and use defaults
        }
      }
      
      // Store config in env for vite middleware to pass to client
      const envVisualizerConfig = JSON.stringify(graphConfig);
      process.env.AIREADY_VISUALIZER_CONFIG = envVisualizerConfig;

      console.log("Building graph from report...");
      const { GraphBuilder } = await import('@aiready/visualizer/graph');
      const graph = GraphBuilder.buildFromReport(report, dirPath);

      if (options.dev) {
        try {
          const { spawn } = await import("child_process");
          const monorepoWebDir = resolvePath(dirPath, 'packages/visualizer');
          let webDir = '';
          let visualizerAvailable = false;
          if (existsSync(monorepoWebDir)) {
            webDir = monorepoWebDir;
            visualizerAvailable = true;
          } else {
            // Try to resolve installed @aiready/visualizer package from node_modules
            // Check multiple locations to support pnpm, npm, yarn, etc.
            const nodemodulesLocations: string[] = [
              resolvePath(dirPath, 'node_modules', '@aiready', 'visualizer'),
              resolvePath(process.cwd(), 'node_modules', '@aiready', 'visualizer'),
            ];
            
            // Walk up directory tree to find node_modules in parent directories
            let currentDir = dirPath;
            while (currentDir !== '/' && currentDir !== '.') {
              nodemodulesLocations.push(resolvePath(currentDir, 'node_modules', '@aiready', 'visualizer'));
              const parent = resolvePath(currentDir, '..');
              if (parent === currentDir) break; // Reached filesystem root
              currentDir = parent;
            }
            
            for (const location of nodemodulesLocations) {
              if (existsSync(location) && existsSync(resolvePath(location, 'package.json'))) {
                webDir = location;
                visualizerAvailable = true;
                break;
              }
            }
            
            // Fallback: try require.resolve
            if (!visualizerAvailable) {
              try {
                const vizPkgPath = require.resolve('@aiready/visualizer/package.json');
                webDir = resolvePath(vizPkgPath, '..');
                visualizerAvailable = true;
              } catch (e) {
                // Visualizer not found
              }
            }
          }
          const spawnCwd = webDir || process.cwd();
          const nodeBinCandidate = process.execPath;
          const nodeBin = existsSync(nodeBinCandidate) ? nodeBinCandidate : 'node';
          if (!visualizerAvailable) {
            console.error(chalk.red('❌ Cannot start dev server: @aiready/visualizer not available.'));
            console.log(chalk.dim('Install @aiready/visualizer in your project with:\n  npm install @aiready/visualizer'));
            return;
          }

          // Inline report watcher: copy report to web/report-data.json and watch for changes
          const { watch } = await import('fs');
          const copyReportToViz = () => {
            try {
              const destPath = resolvePath(spawnCwd, 'web', 'report-data.json');
              copyFileSync(reportPath, destPath);
              console.log(`📋 Report synced to ${destPath}`);
            } catch (e) {
              console.error('Failed to sync report:', e);
            }
          };
          
          // Initial copy
          copyReportToViz();
          
          // Watch source report for changes
          let watchTimeout: NodeJS.Timeout | null = null;
          const reportWatcher = watch(reportPath, () => {
            // Debounce to avoid multiple copies during file write
            if (watchTimeout) clearTimeout(watchTimeout);
            watchTimeout = setTimeout(copyReportToViz, 100);
          });

          const envForSpawn = { 
            ...process.env, 
            AIREADY_REPORT_PATH: reportPath,
            AIREADY_VISUALIZER_CONFIG: envVisualizerConfig 
          };
          const vite = spawn("pnpm", ["run", "dev:web"], { cwd: spawnCwd, stdio: "inherit", shell: true, env: envForSpawn });
          const onExit = () => {
            try {
              reportWatcher.close();
            } catch (e) {}
            try {
              vite.kill();
            } catch (e) {}
            process.exit(0);
          };
          process.on("SIGINT", onExit);
          process.on("SIGTERM", onExit);
          return;
        } catch (err) {
          console.error("Failed to start dev server:", err);
        }
      }

      console.log("Generating HTML...");
      const html = generateHTML(graph);
      const outPath = resolvePath(dirPath, options.output || 'packages/visualizer/visualization.html');
      writeFileSync(outPath, html, 'utf8');
      console.log("Visualization written to:", outPath);
      

      if (options.open) {
        const { exec } = await import('child_process');
        const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${opener} "${outPath}"`);
      }

      if (options.serve) {
        try {
          const port = Number(options.serve) || 5173;
          const http = await import('http');
          const fsp = await import('fs/promises');
          const { exec } = await import('child_process');

          const server = http.createServer(async (req, res) => {
            try {
              const urlPath = req.url || '/';
              if (urlPath === '/' || urlPath === '/index.html') {
                const content = await fsp.readFile(outPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
                return;
              }
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not found');
            } catch (e: any) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Server error');
            }
          });

          server.listen(port, () => {
            const addr = `http://localhost:${port}/`;
            console.log(`Local visualization server running at ${addr}`);
            const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${opener} "${addr}"`);
          });

          process.on('SIGINT', () => {
            server.close();
            process.exit(0);
          });
        } catch (err) {
          console.error('Failed to start local server:', err);
        }
      }

    } catch (err: any) {
      handleCLIError(err, 'Visualization');
    }
  }

// Visualize command: build interactive HTML from an AIReady report
program
  .command('visualise')
  .description('Alias for visualize (British spelling)')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('--report <path>', 'Report path (auto-detects latest .aiready/aiready-report-*.json if not provided)')
  .option('-o, --output <path>', 'Output HTML path (relative to directory)', 'packages/visualizer/visualization.html')
  .option('--open', 'Open generated HTML in default browser')
  .option('--serve [port]', 'Start a local static server to serve the visualization (optional port number)', false)
  .option('--dev', 'Start Vite dev server (live reload) for interactive development', true)
  .addHelpText('after', `
EXAMPLES:
  $ aiready visualise .  # Auto-detects latest report
  $ aiready visualise . --report .aiready/aiready-report-20260217-143022.json
  $ aiready visualise . --report report.json --dev
  $ aiready visualise . --report report.json --serve 8080

NOTES:
  - Same options as \'visualize\'. Use --dev for live reload and --serve to host a static HTML.
`)
  .action(async (directory, options) => await handleVisualize(directory, options));

program
  .command('visualize')
  .description('Generate interactive visualization from an AIReady report')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('--report <path>', 'Report path (auto-detects latest .aiready/aiready-report-*.json if not provided)')
  .option('-o, --output <path>', 'Output HTML path (relative to directory)', 'packages/visualizer/visualization.html')
  .option('--open', 'Open generated HTML in default browser')
  .option('--serve [port]', 'Start a local static server to serve the visualization (optional port number)', false)
  .option('--dev', 'Start Vite dev server (live reload) for interactive development', false)
  .addHelpText('after', `
EXAMPLES:
  $ aiready visualize .  # Auto-detects latest report
  $ aiready visualize . --report .aiready/aiready-report-20260217-143022.json
  $ aiready visualize . --report report.json -o out/visualization.html --open
  $ aiready visualize . --report report.json --serve
  $ aiready visualize . --report report.json --serve 8080
  $ aiready visualize . --report report.json --dev

NOTES:
  - The value passed to --report is interpreted relative to the directory argument (first positional).
    If the report is not found, the CLI will suggest running 'aiready scan' to generate it.
  - Default output path: packages/visualizer/visualization.html (relative to the directory argument).
  - --serve starts a tiny single-file HTTP server (default port: 5173) and opens your browser.
    It serves only the generated HTML (no additional asset folders).
  - Relatedness is represented by node proximity and size; explicit 'related' edges are not drawn to
    reduce clutter and improve interactivity on large graphs.
  - For very large graphs, consider narrowing the input with --include/--exclude or use --serve and
    allow the browser a moment to stabilize after load.
`)
  .action(async (directory, options) => await handleVisualize(directory, options));

program.parse();