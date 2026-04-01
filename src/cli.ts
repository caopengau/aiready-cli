#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  defineScanCommand,
  initAction,
  definePatternsCommand,
  defineContextCommand,
  defineConsistencyCommand,
  visualizeAction,
  VISUALIZE_HELP_TEXT,
  VISUALISE_HELP_TEXT,
  changeAmplificationAction,
  testabilityAction,
  contractEnforcementAction,
  uploadAction,
  UPLOAD_HELP_TEXT,
  remediateAction,
  REMEDIATE_HELP_TEXT,
  bugAction,
  BUG_HELP_TEXT,
} from './commands';

/**
 * CLI Constants for configuration and help text.
 */
const CLI_CONSTANTS = {
  NAME: 'aiready',
  DESCRIPTION: 'AIReady - Assess and improve AI-readiness of codebases',
  CONFIG_FILES: 'aiready.json, .aiready.json, aiready.config.*',
  DOCS_URL: 'https://getaiready.dev/docs/cli',
  GITHUB_URL: 'https://github.com/getaiready/aiready-cli',
  LANDING_URL: 'https://github.com/getaiready/aiready-landing',
  DEFAULT_DIRECTORY: '.',
  FORMATS: {
    JSON: 'json',
    JS: 'js',
    CONSOLE: 'console',
  },
  ALIASES: {
    VISUALISE: 'visualise',
    VISUALIZE: 'visualize',
  },
  OPTIONS: {
    FORCE: '-f, --force',
    JS: '--js',
    FULL: '--full',
    REPORT: '--report <path>',
    OUTPUT: '-o, --output <path>',
    OPEN: '--open',
    SERVE: '--serve [port]',
    DEV: '--dev',
    INCLUDE: '--include <patterns>',
    EXCLUDE: '--exclude <patterns>',
    OUTPUT_FILE: '--output-file <path>',
    MIN_COVERAGE: '--min-coverage <ratio>',
    MIN_CHAIN_DEPTH: '--min-chain-depth <depth>',
    API_KEY: '--api-key <key>',
    REPO_ID: '--repo-id <id>',
    SERVER: '--server <url>',
    TOOL: '-t, --tool <name>',
    TYPE: '-t, --type <type>',
    SUBMIT: '--submit',
  },
} as const;

/**
 * Get the current directory name, handling both ESM and CJS.
 */
const getDirname = () => {
  if (typeof __dirname !== 'undefined') return __dirname;
  return dirname(fileURLToPath(import.meta.url));
};

const packageJson = JSON.parse(
  readFileSync(join(getDirname(), '../package.json'), 'utf8')
);

const program = new Command();

program
  .name(CLI_CONSTANTS.NAME)
  .description(CLI_CONSTANTS.DESCRIPTION)
  .version(packageJson.version)
  .addHelpText(
    'after',
    `
AI READINESS SCORING:
  Get a 0-100 score indicating how AI-ready your codebase is.
  Use --score flag with any analysis command for detailed breakdown.

EXAMPLES:
  $ ${CLI_CONSTANTS.NAME} scan                          # Comprehensive analysis with AI Readiness Score
  $ ${CLI_CONSTANTS.NAME} scan --no-score               # Run scan without score calculation
  $ ${CLI_CONSTANTS.NAME} init                          # Create a default aiready.json configuration
  $ ${CLI_CONSTANTS.NAME} init --full                   # Create configuration with ALL available options
  $ npx @${CLI_CONSTANTS.NAME}/cli scan                 # Industry standard way to run standard scan
  $ ${CLI_CONSTANTS.NAME} scan --output json            # Output raw JSON for piping

GETTING STARTED:
  1. Run '${CLI_CONSTANTS.NAME} init' to create a persistent 'aiready.json' config file
  2. Run '${CLI_CONSTANTS.NAME} scan' to analyze your codebase and get an AI Readiness Score
  3. Use '${CLI_CONSTANTS.NAME} init --full' to see every fine-tuning parameter available
  4. Use '--profile agentic' for agent-focused analysis
  5. Set up CI/CD with '--threshold' for quality gates

CONFIGURATION:
  Config files (searched upward): ${CLI_CONSTANTS.CONFIG_FILES}
  CLI options override config file settings

VERSION: ${packageJson.version}
DOCUMENTATION: ${CLI_CONSTANTS.DOCS_URL}
GITHUB: ${CLI_CONSTANTS.GITHUB_URL}
LANDING: ${CLI_CONSTANTS.LANDING_URL}`
  );

// Core analysis commands
defineScanCommand(program);
definePatternsCommand(program);
defineContextCommand(program);
defineConsistencyCommand(program);

// Init command
program
  .command('init')
  .description('Generate a default configuration (aiready.json)')
  .option(CLI_CONSTANTS.OPTIONS.FORCE, 'Overwrite existing configuration file')
  .option(
    CLI_CONSTANTS.OPTIONS.JS,
    'Generate configuration as a JavaScript file (aiready.config.js)'
  )
  .option(
    CLI_CONSTANTS.OPTIONS.FULL,
    'Generate a full configuration with all available options'
  )
  .action(async (options) => {
    const format = options.js
      ? CLI_CONSTANTS.FORMATS.JS
      : CLI_CONSTANTS.FORMATS.JSON;
    await initAction({ force: !!options.force, format, full: !!options.full });
  });

// Visualization commands
program
  .command(CLI_CONSTANTS.ALIASES.VISUALISE)
  .description('Alias for visualize (British spelling)')
  .argument(
    '[directory]',
    'Directory to analyze',
    CLI_CONSTANTS.DEFAULT_DIRECTORY
  )
  .option(
    CLI_CONSTANTS.OPTIONS.REPORT,
    'Report path (auto-detects latest .aiready/aiready-report-*.json if not provided)'
  )
  .option(
    CLI_CONSTANTS.OPTIONS.OUTPUT,
    'Output HTML path (relative to directory)',
    'visualization.html'
  )
  .option(CLI_CONSTANTS.OPTIONS.OPEN, 'Open generated HTML in default browser')
  .option(
    CLI_CONSTANTS.OPTIONS.SERVE,
    'Start a local static server to serve the visualization (optional port number)',
    false
  )
  .option(
    CLI_CONSTANTS.OPTIONS.DEV,
    'Start Vite dev server (live reload) for interactive development',
    true
  )
  .addHelpText('after', VISUALISE_HELP_TEXT)
  .action(async (directory, options) => {
    await visualizeAction(directory, {
      ...options,
      force: !!options.force,
      open: !!options.open,
      dev: !!options.dev,
    });
  });

program
  .command(CLI_CONSTANTS.ALIASES.VISUALIZE)
  .description('Generate interactive visualization from an AIReady report')
  .argument(
    '[directory]',
    'Directory to analyze',
    CLI_CONSTANTS.DEFAULT_DIRECTORY
  )
  .option(
    CLI_CONSTANTS.OPTIONS.REPORT,
    'Report path (auto-detects latest .aiready/aiready-report-*.json if not provided)'
  )
  .option(
    CLI_CONSTANTS.OPTIONS.OUTPUT,
    'Output HTML path (relative to directory)',
    'visualization.html'
  )
  .option(CLI_CONSTANTS.OPTIONS.OPEN, 'Open generated HTML in default browser')
  .option(
    CLI_CONSTANTS.OPTIONS.SERVE,
    'Start a local static server to serve the visualization (optional port number)',
    false
  )
  .option(
    CLI_CONSTANTS.OPTIONS.DEV,
    'Start Vite dev server (live reload) for interactive development',
    false
  )
  .addHelpText('after', VISUALIZE_HELP_TEXT)
  .action(async (directory, options) => {
    await visualizeAction(directory, {
      ...options,
      force: !!options.force,
      open: !!options.open,
      dev: !!options.dev,
    });
  });

// Utility commands
program
  .command('change-amplification')
  .description('Analyze graph metrics for change amplification')
  .argument(
    '[directory]',
    'Directory to analyze',
    CLI_CONSTANTS.DEFAULT_DIRECTORY
  )
  .option(
    CLI_CONSTANTS.OPTIONS.INCLUDE,
    'File patterns to include (comma-separated)'
  )
  .option(
    CLI_CONSTANTS.OPTIONS.EXCLUDE,
    'File patterns to exclude (comma-separated)'
  )
  .option(
    '-o, --output <format>',
    'Output format: console, json',
    CLI_CONSTANTS.FORMATS.CONSOLE
  )
  .option(CLI_CONSTANTS.OPTIONS.OUTPUT_FILE, 'Output file path (for json)')
  .option('--score', 'Calculate and display AI Readiness Score (0-100)', true)
  .option('--no-score', 'Disable calculating AI Readiness Score')
  .action(async (directory, options) => {
    await changeAmplificationAction(directory, options);
  });

program
  .command('testability')
  .description('Analyze test coverage and AI readiness')
  .argument(
    '[directory]',
    'Directory to analyze',
    CLI_CONSTANTS.DEFAULT_DIRECTORY
  )
  .option(
    CLI_CONSTANTS.OPTIONS.MIN_COVERAGE,
    'Minimum acceptable coverage ratio',
    '0.3'
  )
  .option(
    CLI_CONSTANTS.OPTIONS.INCLUDE,
    'File patterns to include (comma-separated)'
  )
  .option(
    CLI_CONSTANTS.OPTIONS.EXCLUDE,
    'File patterns to exclude (comma-separated)'
  )
  .option(
    '-o, --output <format>',
    'Output format: console, json',
    CLI_CONSTANTS.FORMATS.CONSOLE
  )
  .option(CLI_CONSTANTS.OPTIONS.OUTPUT_FILE, 'Output file path (for json)')
  .option('--score', 'Calculate and display AI Readiness Score (0-100)', true)
  .option('--no-score', 'Disable calculating AI Readiness Score')
  .action(async (directory, options) => {
    await testabilityAction(directory, options);
  });

program
  .command('contract')
  .description('Analyze structural contract enforcement and defensive coding')
  .argument(
    '[directory]',
    'Directory to analyze',
    CLI_CONSTANTS.DEFAULT_DIRECTORY
  )
  .option(
    CLI_CONSTANTS.OPTIONS.MIN_CHAIN_DEPTH,
    'Minimum optional chain depth to flag',
    '3'
  )
  .option(
    CLI_CONSTANTS.OPTIONS.INCLUDE,
    'File patterns to include (comma-separated)'
  )
  .option(
    CLI_CONSTANTS.OPTIONS.EXCLUDE,
    'File patterns to exclude (comma-separated)'
  )
  .option(
    '-o, --output <format>',
    'Output format: console, json',
    CLI_CONSTANTS.FORMATS.CONSOLE
  )
  .option(CLI_CONSTANTS.OPTIONS.OUTPUT_FILE, 'Output file path (for json)')
  .option('--score', 'Calculate and display AI Readiness Score (0-100)', true)
  .option('--no-score', 'Disable calculating AI Readiness Score')
  .action(async (directory, options) => {
    await contractEnforcementAction(directory, options);
  });

program
  .command('upload')
  .description('Upload an AIReady report JSON to the platform')
  .argument('<file>', 'Report JSON file to upload')
  .option(CLI_CONSTANTS.OPTIONS.API_KEY, 'Platform API key')
  .option(CLI_CONSTANTS.OPTIONS.REPO_ID, 'Platform repository ID (optional)')
  .option(CLI_CONSTANTS.OPTIONS.SERVER, 'Custom platform URL')
  .addHelpText('after', UPLOAD_HELP_TEXT)
  .action(async (file, options) => {
    await uploadAction(file, options);
  });

program
  .command('remediate')
  .description('Suggest AI-ready refactors based on a scan report')
  .argument(
    '[directory]',
    'Directory to remediate',
    CLI_CONSTANTS.DEFAULT_DIRECTORY
  )
  .option(CLI_CONSTANTS.OPTIONS.REPORT, 'AIReady report JSON file')
  .option(
    CLI_CONSTANTS.OPTIONS.TOOL,
    'Filter by tool: patterns, context, consistency'
  )
  .option(CLI_CONSTANTS.OPTIONS.SERVER, 'Custom platform URL')
  .addHelpText('after', REMEDIATE_HELP_TEXT)
  .action(async (directory, options) => {
    await remediateAction(directory, options);
  });

program
  .command('bug')
  .description('Report a bug or provide feedback (Agent-friendly)')
  .argument('[message]', 'Short description of the issue')
  .option(CLI_CONSTANTS.OPTIONS.TYPE, 'Issue type: bug, feature, metric', 'bug')
  .option(
    CLI_CONSTANTS.OPTIONS.SUBMIT,
    'Submit the issue directly using the GitHub CLI (gh)'
  )
  .addHelpText('after', BUG_HELP_TEXT)
  .action(async (message, options) => {
    await bugAction(message, { ...options, submit: !!options.submit });
  });

program.parse();
