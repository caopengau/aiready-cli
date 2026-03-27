/**
 * Helper utilities for the scan command
 */

import chalk from 'chalk';
import {
  handleCLIError,
  getElapsedTime,
  prepareActionConfig,
  resolveOutputFormat,
  formatStandardReport,
  handleStandardJSONOutput,
  ToolScoringOutput,
  ToolName,
} from '@aiready/core';

export interface ScanOptions {
  tools?: string;
  profile?: string;
  compareTo?: string;
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
  noScore?: boolean;
  weights?: string;
  threshold?: string;
  ci?: boolean;
  failOn?: string;
  model?: string;
  apiKey?: string;
  upload?: boolean;
  server?: string;
}

/**
 * Common options for all tool-specific commands
 */
export interface BaseCommandOptions {
  include?: string;
  exclude?: string;
  output?: string;
  outputFile?: string;
  score?: boolean;
}

/**
 * Configuration for the generic tool action
 */
export interface ToolActionConfig<TResults, TSummary, TOptions> {
  toolName: string;
  label: string;
  emoji: string;
  defaults: TOptions;
  getCliOptions: (options: any) => Partial<TOptions>;
  importTool: () => Promise<{
    analyze: (options: TOptions) => Promise<TResults>;
    generateSummary: (results: TResults) => TSummary;
    calculateScore?: (data: any, resultsCount?: number) => ToolScoringOutput;
  }>;
  renderConsole: (data: {
    results: TResults;
    summary: TSummary;
    elapsedTime: string;
    score?: ToolScoringOutput;
    finalOptions: TOptions;
  }) => void;
  // Hook for tool-specific extra steps (like smart defaults)
  preAnalyze?: (
    resolvedDir: string,
    baseOptions: TOptions
  ) => Promise<TOptions>;
}

/**
 * Generic tool action runner to eliminate boilerplate duplication
 */
export async function executeToolAction<
  TResults,
  TSummary,
  TOptions extends Record<string, any>,
>(
  directory: string,
  options: BaseCommandOptions & any,
  config: ToolActionConfig<TResults, TSummary, TOptions>
) {
  console.log(chalk.blue(`${config.emoji} ${config.label}...\n`));

  const startTime = Date.now();

  try {
    // 1. Prepare config
    const { resolvedDir, finalOptions: baseOptions } =
      await prepareActionConfig(
        directory,
        config.defaults as any,
        config.getCliOptions(options)
      );

    let finalOptions = baseOptions as unknown as TOptions;

    // 2. Pre-analyze hook (e.g. for smart defaults)
    if (config.preAnalyze) {
      finalOptions = await config.preAnalyze(resolvedDir, finalOptions);
    }

    // 3. Import and run tool
    const { analyze, generateSummary, calculateScore } =
      await config.importTool();
    const results = await analyze(finalOptions);

    const elapsedTime = getElapsedTime(startTime);
    const summary = generateSummary(results);

    // 4. Calculate score if requested
    let toolScore: ToolScoringOutput | undefined;
    if ((options.score || (finalOptions as any).score) && calculateScore) {
      // Some tools like pattern-detect need extra data from results
      // Different tools have different signatures:
      // - pattern-detect: calculateScore(duplicates, totalFilesAnalyzed)
      // - consistency: calculateScore(issues, totalFilesAnalyzed)
      // - others: calculateScore(summary)
      const resultsAny = results as any;
      const scoreData = resultsAny.duplicates || resultsAny.issues || results;
      const filesCount =
        resultsAny.length ||
        resultsAny.summary?.filesAnalyzed ||
        resultsAny.summary?.totalFiles;
      toolScore = calculateScore(scoreData, filesCount);
    }

    // 5. Handle output
    const { format: outputFormat, file: userOutputFile } = resolveOutputFormat(
      options,
      finalOptions as any
    );

    const outputData = formatStandardReport({
      results,
      summary,
      elapsedTime,
      score: toolScore,
    });

    if (outputFormat === 'json') {
      handleStandardJSONOutput({
        outputData,
        outputFile: userOutputFile,
        resolvedDir,
      });
    } else {
      // 6. Console output
      config.renderConsole({
        results,
        summary,
        elapsedTime,
        score: toolScore,
        finalOptions,
      });
    }

    return outputData;
  } catch (error) {
    handleCLIError(error, config.label);
    return undefined;
  }
}

/**
 * Map profile name to tool IDs
 */
export function getProfileTools(profile: string): string[] | undefined {
  switch (profile.toLowerCase()) {
    case 'agentic':
      return [
        ToolName.AiSignalClarity,
        ToolName.AgentGrounding,
        ToolName.TestabilityIndex,
        ToolName.ContractEnforcement,
      ];
    case 'cost':
      return [ToolName.PatternDetect, ToolName.ContextAnalyzer];
    case 'logic':
      return [
        ToolName.TestabilityIndex,
        ToolName.NamingConsistency,
        ToolName.ContextAnalyzer,
        ToolName.PatternDetect,
        ToolName.ChangeAmplification,
        ToolName.ContractEnforcement,
      ];
    case 'ui':
      return [
        ToolName.NamingConsistency,
        ToolName.ContextAnalyzer,
        ToolName.PatternDetect,
        ToolName.DocDrift,
        ToolName.AiSignalClarity,
      ];
    case 'security':
      return [
        ToolName.NamingConsistency,
        ToolName.TestabilityIndex,
        ToolName.ContractEnforcement,
      ];
    case 'onboarding':
      return [
        ToolName.ContextAnalyzer,
        ToolName.NamingConsistency,
        ToolName.AgentGrounding,
      ];
    default:
      console.log(
        chalk.yellow(`\n⚠️  Unknown profile '${profile}'. Using defaults.`)
      );
      return undefined;
  }
}

/**
 * Get default tools list
 */
export function getDefaultTools(): string[] {
  return [
    'pattern-detect',
    'context-analyzer',
    'naming-consistency',
    'ai-signal-clarity',
    'agent-grounding',
    'testability-index',
    'doc-drift',
    'dependency-health',
    'change-amplification',
    'contract-enforcement',
  ];
}

/**
 * Create progress callback for tool execution
 */
export function createProgressCallback() {
  return (event: any) => {
    // Handle progress messages
    if (event.message) {
      process.stdout.write(`\r\x1b[K   [${event.tool}] ${event.message}`);
      return;
    }

    // Handle tool completion
    process.stdout.write('\r\x1b[K'); // Clear the progress line
    console.log(chalk.cyan(`--- ${event.tool.toUpperCase()} RESULTS ---`));
    const toolResult = event.data;
    if (toolResult && toolResult.summary) {
      if (toolResult.summary.totalIssues !== undefined)
        console.log(
          `  Issues found: ${chalk.bold(toolResult.summary.totalIssues)}`
        );
      if (toolResult.summary.score !== undefined)
        console.log(
          `  Tool Score: ${chalk.bold(toolResult.summary.score)}/100`
        );
      if (toolResult.summary.totalFiles !== undefined)
        console.log(
          `  Files analyzed: ${chalk.bold(toolResult.summary.totalFiles)}`
        );
    }
  };
}
