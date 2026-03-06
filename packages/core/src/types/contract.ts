/**
 * Spoke-to-Hub Contract Definitions
 * This file defines the expected JSON structure for tool outputs to ensure
 * changes in spokes don't break the CLI, Platform, or Visualizer.
 */

import { z } from 'zod';
import {
  AnalysisResult,
  SpokeOutput,
  UnifiedReport,
  ScanOptions,
} from '../types';
import { ToolName } from './schema';
import { ToolScoringOutput } from '../scoring';

export type { SpokeOutput, UnifiedReport };

/**
 * Tool Provider Interface
 * Every AIReady spoke must implement this interface to be integrated into the CLI registry.
 */
export interface ToolProvider {
  /** Canonical tool ID */
  id: ToolName;

  /** CLI aliases/shorthand for this tool */
  alias: string[];

  /** Primary analysis logic */
  analyze: (options: ScanOptions) => Promise<SpokeOutput>;

  /** Scoring logic for this tool's output */
  score: (output: SpokeOutput, options: ScanOptions) => ToolScoringOutput;

  /** Optional weight override for this tool */
  defaultWeight?: number;
}

/**
 * Validation utility to ensure a spoke's output matches the expected contract.
 * Used in spoke tests to catch breakages early.
 */
export function validateSpokeOutput(
  toolName: string,
  output: any
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!output) {
    return { valid: false, errors: ['Output is null or undefined'] };
  }

  // 1. Check results array
  if (!Array.isArray(output.results)) {
    errors.push(`${toolName}: 'results' must be an array`);
  } else {
    output.results.forEach((res: any, idx: number) => {
      // Allow 'file' or 'filePath' as alias for 'fileName' (common in some spokes)
      const fileName = res.fileName || res.file || res.filePath;
      if (!fileName)
        errors.push(
          `${toolName}: results[${idx}] missing 'fileName', 'file' or 'filePath'`
        );

      // Some spokes (like context-analyzer) produce a list of results where each result
      // has top-level severity/issues, OR they follow the standard AnalysisResult format.
      const issues = res.issues;
      if (!Array.isArray(issues)) {
        errors.push(`${toolName}: results[${idx}] 'issues' must be an array`);
      } else if (issues.length > 0) {
        // Validate issue structure if issues exist
        issues.forEach((issue: any, iidx: number) => {
          // If it's a string array (simple issues), it's valid for some spokes
          if (typeof issue === 'string') return;

          if (!issue.type && !res.file)
            errors.push(
              `${toolName}: results[${idx}].issues[${iidx}] missing 'type'`
            );
          if (!issue.severity && !res.severity)
            errors.push(
              `${toolName}: results[${idx}].issues[${iidx}] missing 'severity'`
            );

          const severity = issue.severity || res.severity;
          if (
            severity &&
            !['critical', 'major', 'minor', 'info'].includes(severity)
          ) {
            errors.push(
              `${toolName}: results[${idx}].issues[${iidx}] has invalid severity: ${severity}`
            );
          }
        });
      }
    });
  }

  // 2. Check summary
  if (!output.summary) {
    errors.push(`${toolName}: missing 'summary'`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Zod-based validation (Round 1 improvement)
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: any
): { valid: boolean; data?: T; errors?: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return {
    valid: false,
    errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}
