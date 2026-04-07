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
    changedFilesOnly: options.changedFilesOnly,
  };
  if (options.include) cliOverrides.include = options.include.split(',');
  if (options.exclude) cliOverrides.exclude = options.exclude.split(',');
  if (profileTools) cliOverrides.tools = profileTools;

  const baseOptions = (await loadMergedConfig(
    resolvedDir,
    SCAN_DEFAULTS,
    cliOverrides
  )) as Record<string, unknown>;

  // Apply smart defaults for pattern detection if requested
  const finalOptions = { ...baseOptions };
  const tools = baseOptions.tools as string[] | undefined;
  if (tools?.includes(ToolName.PatternDetect) || tools?.includes('patterns')) {
    const { getSmartDefaults } = await import('@aiready/pattern-detect');
    const toolConfigs = finalOptions.toolConfigs as
      | Record<string, unknown>
      | undefined;
    const patternSmartDefaults = await getSmartDefaults(
      resolvedDir,
      (toolConfigs?.[ToolName.PatternDetect] as Record<string, unknown>) ?? {}
    );

    // Merge smart defaults into toolConfigs instead of root level
    if (!finalOptions.toolConfigs) finalOptions.toolConfigs = {};
    const configs = finalOptions.toolConfigs as Record<string, unknown>;
    configs[ToolName.PatternDetect] = {
      ...patternSmartDefaults,
      ...(configs[ToolName.PatternDetect] as Record<string, unknown>),
    };
  }

  return finalOptions;
}
