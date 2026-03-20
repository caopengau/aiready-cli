import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { ToolName } from '@aiready/core';

export async function initAction(options: {
  force?: boolean;
  format?: 'json' | 'js';
  full?: boolean;
}) {
  const fileExt = options.format === 'js' ? 'js' : 'json';
  const fileName = fileExt === 'js' ? 'aiready.config.js' : 'aiready.json';
  const filePath = join(process.cwd(), fileName);

  if (existsSync(filePath) && !options.force) {
    console.error(
      chalk.red(`Error: ${fileName} already exists. Use --force to overwrite.`)
    );
    process.exit(1);
  }

  const baseConfig = {
    $schema: 'https://getaiready.dev/schema.json',

    // Target quality score threshold (0-100)
    threshold: 75,

    // Global scan settings
    scan: {
      include: [
        'src/**/*.ts',
        'src/**/*.js',
        'lib/**/*.ts',
        'packages/*/src/**/*.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      tools: [
        ToolName.PatternDetect,
        ToolName.ContextAnalyzer,
        ToolName.NamingConsistency,
        ToolName.AiSignalClarity,
        ToolName.AgentGrounding,
        ToolName.TestabilityIndex,
        ToolName.DocDrift,
        ToolName.DependencyHealth,
        ToolName.ChangeAmplification,
      ],
    },

    // Output preferences
    output: {
      format: 'console',
      showBreakdown: true,
      saveTo: 'aiready-report.json',
    },

    // Scoring profile and weights
    scoring: {
      profile: 'balanced',
    },

    // Tool-specific configurations
    tools: {
      [ToolName.PatternDetect]: {
        // Core detection thresholds
        minSimilarity: 0.4, // Jaccard similarity threshold (0-1)
        minLines: 5, // Minimum lines to consider a duplicate
        minSharedTokens: 8, // Minimum shared tokens for candidate matching
        approx: true, // Use approximate matching for performance

        // Performance tuning
        batchSize: 100, // Batch size for comparisons
        maxCandidatesPerBlock: 100, // Max candidates per code block
        maxResults: 10, // Max results in console output

        // Cluster reporting
        minClusterFiles: 3, // Min files for cluster reporting
        minClusterTokenCost: 1000, // Min token cost for cluster reporting

        // Output
        outputFormat: 'console', // Output format (console, json, html)

        ...(options.full
          ? {
              // Advanced options (only included with --full)
              // Add any additional advanced options here
            }
          : {}),
      },
      [ToolName.ContextAnalyzer]: {
        // Smart defaults are generated dynamically based on repository size
        // These are fallback values for when smart defaults can't be calculated
        maxContextBudget: 25000, // Max acceptable token budget for a single context
        minCohesion: 0.4, // Minimum acceptable cohesion score (0-1)
        maxDepth: 7, // Maximum acceptable import depth
        maxFragmentation: 0.7, // Maximum acceptable fragmentation score (0-1)

        // Analysis focus
        focus: 'all', // Analysis focus: fragmentation, cohesion, depth, or all
        includeNodeModules: false, // Whether to include node_modules in analysis
      },
      [ToolName.NamingConsistency]: {
        // Core checks
        checkNaming: true, // Check naming conventions and quality
        checkPatterns: true, // Check code pattern consistency
        checkArchitecture: true, // Check architectural consistency

        // Minimum severity to report
        minSeverity: 'info', // Severity filter: critical, major, minor, info

        // Custom vocabulary
        shortWords: ['id', 'db', 'ui', 'ai'],
        acceptedAbbreviations: [
          'API',
          'JSON',
          'CSV',
          'HTML',
          'CSS',
          'HTTP',
          'URL',
          'SDK',
          'CLI',
          'AI',
          'ML',
          'ID',
          'DB',
          'UI',
          'UX',
          'DOM',
          'UUID',
          'GUID',
          'DEFAULT',
          'MAX',
          'MIN',
          'config',
          'INIT',
          'SKILL',
          'ENV',
          'DEV',
          'PROD',
          'AWS',
          'S3',
          'ARN',
        ],
        ...(options.full ? { disableChecks: [] } : {}),
      },
      [ToolName.AiSignalClarity]: {
        // All signal clarity checks enabled by default
        checkMagicLiterals: true, // Detect magic numbers and strings
        checkBooleanTraps: true, // Detect boolean trap parameters
        checkAmbiguousNames: true, // Detect ambiguous function/variable names
        checkUndocumentedExports: true, // Detect exports without documentation
        checkImplicitSideEffects: true, // Detect functions with hidden side effects
        checkDeepCallbacks: true, // Detect deeply nested callbacks
        checkOverloadedSymbols: true, // Detect overloaded function signatures
        checkLargeFiles: true, // Detect files that are too large
      },
      [ToolName.AgentGrounding]: {
        // Structure clarity
        maxRecommendedDepth: 4, // Max directory depth before flagging as "too deep"

        // Documentation freshness
        readmeStaleDays: 90, // Days after which README is considered stale

        // File naming
        additionalVagueNames: ['stuff', 'misc', 'temp', 'test'], // Custom vague file names
      },
      [ToolName.TestabilityIndex]: {
        // Coverage thresholds
        minCoverageRatio: 0.3, // Minimum acceptable test/source ratio

        // Test file patterns
        testPatterns: ['**/*.test.ts', '**/__tests__/**', '**/*.spec.ts'],

        // Scan depth
        maxDepth: 10, // Maximum scan depth
      },
      [ToolName.DocDrift]: {
        // Drift detection
        maxCommits: 50, // Maximum commit distance to check for drift
        staleMonths: 3, // Consider comments older than this as outdated
      },
      [ToolName.DependencyHealth]: {
        // Training cutoff for AI knowledge assessment
        trainingCutoffYear: 2023, // Year cutoff for AI training data
      },
      [ToolName.ChangeAmplification]: {
        // Change amplification primarily relies on global scan settings
        // No additional tool-specific configuration required
      },
    },

    // Visualizer settings (interactive graph)
    visualizer: {
      groupingDirs: ['packages', 'src', 'lib'],
      graph: {
        maxNodes: 5000,
        maxEdges: 10000,
      },
    },
  };

  const defaultConfig = baseConfig;

  let content: string;
  if (fileExt === 'js') {
    content = `/** 
 * AIReady Configuration
 * @type {import('@aiready/core').AIReadyConfig} 
 */
module.exports = ${JSON.stringify(defaultConfig, null, 2)};\n`;
  } else {
    content = JSON.stringify(defaultConfig, null, 2);
  }

  try {
    writeFileSync(filePath, content, 'utf8');
    console.log(
      chalk.green(`\n✅ Created default configuration: ${chalk.bold(fileName)}`)
    );
    console.log(
      chalk.cyan('You can now fine-tune your settings and run AIReady with:')
    );
    console.log(chalk.white(`  $ aiready scan\n`));
  } catch (error) {
    console.error(chalk.red(`Failed to write configuration file: ${error}`));
    process.exit(1);
  }
}
