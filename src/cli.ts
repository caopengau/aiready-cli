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
        const pd = finalOptions['pattern-detect'] || {
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
        console.log(`  minSimilarity: ${chalk.bold(pd.minSimilarity ?? 'default')}`);
        console.log(`  minLines: ${chalk.bold(pd.minLines ?? 'default')}`);
        if (pd.approx !== undefined) console.log(`  approx: ${chalk.bold(String(pd.approx))}`);
        if (pd.minSharedTokens !== undefined) console.log(`  minSharedTokens: ${chalk.bold(String(pd.minSharedTokens))}`);
        if (pd.maxCandidatesPerBlock !== undefined) console.log(`  maxCandidatesPerBlock: ${chalk.bold(String(pd.maxCandidatesPerBlock))}`);
        if (pd.batchSize !== undefined) console.log(`  batchSize: ${chalk.bold(String(pd.batchSize))}`);
        if (pd.streamResults !== undefined) console.log(`  streamResults: ${chalk.bold(String(pd.streamResults))}`);
        if (pd.severity !== undefined) console.log(`  severity: ${chalk.bold(String(pd.severity))}`);
        if (pd.includeTests !== undefined) console.log(`  includeTests: ${chalk.bold(String(pd.includeTests))}`);
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

          // Persist JSON summary by default when output is json or when config directory present
          const outputFormat = options.output || finalOptions.output?.format || 'console';
          const userOutputFile = options.outputFile || finalOptions.output?.file;
          if (outputFormat === 'json') {
            const dateStr = new Date().toISOString().split('T')[0];
            const defaultFilename = `aiready-scan-${dateStr}.json`;
            const outputPath = resolveOutputPath(userOutputFile, defaultFilename, directory);
            const outputData = { ...results, scoring: scoringResult };
            handleJSONOutput(outputData, outputPath, `✅ Summary saved to ${outputPath}`);
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