/**
 * Scan configuration - Tool defaults, profile mapping, and config resolution
 */

import { loadMergedConfig, ToolName } from '@aiready/core';
import { getProfileTools, type ScanOptions } from './scan-helpers';

/**
 * Default scan configuration
 */
export const SCAN_DEFAULTS = {
  tools: [
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
  ],
  include: undefined,
  exclude: undefined,
  output: {
    format: 'console',
    file: undefined,
  },
};

/**
 * Resolves the final scan configuration by merging defaults,
 * user-provided options, and any profile-based tool selections.
 *
 * @param resolvedDir - The directory being scanned
 * @param options - CLI options from the scan command
 * @returns The resolved scan configuration
 */
export async function resolveScanConfig(
  resolvedDir: string,
  options: ScanOptions
) {
  // Map profile to tool IDs
  let profileTools: string[] | undefined = options.tools
    ? options.tools.split(',').map((t) => t.trim())
    : undefined;

  if (options.profile) {
    profileTools = getProfileTools(options.profile);
  }

  const cliOverrides: any = {
    include: options.include?.split(','),
    exclude: options.exclude?.split(','),
  };
  if (profileTools) cliOverrides.tools = profileTools;

  const baseOptions = (await loadMergedConfig(
    resolvedDir,
    SCAN_DEFAULTS,
    cliOverrides
  )) as any;

  // Apply smart defaults for pattern detection if requested
  const finalOptions = { ...baseOptions };
  if (
    baseOptions.tools.includes(ToolName.PatternDetect) ||
    baseOptions.tools.includes('patterns')
  ) {
    const { getSmartDefaults } = await import('@aiready/pattern-detect');
    const patternSmartDefaults = await getSmartDefaults(
      resolvedDir,
      finalOptions.toolConfigs?.[ToolName.PatternDetect] ?? {}
    );

    // Merge smart defaults into toolConfigs instead of root level
    if (!finalOptions.toolConfigs) finalOptions.toolConfigs = {};
    finalOptions.toolConfigs[ToolName.PatternDetect] = {
      ...patternSmartDefaults,
      ...finalOptions.toolConfigs[ToolName.PatternDetect],
    };
  }

  return finalOptions;
}
