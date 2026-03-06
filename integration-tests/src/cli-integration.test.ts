import { describe, it, expect } from 'vitest';
// @ts-ignore
import { analyzeUnified, scoreUnified } from '../../packages/cli/dist/index.js';
// @ts-ignore
import {
  validateSpokeOutput,
  ToolRegistry,
  ToolName,
} from '../../packages/core/dist/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CLI Registry Integration', () => {
  it('should dynamically run all registered tools and produce a valid contract-compliant report', async () => {
    // We'll use the packages/core directory as a "real" repo to scan
    const rootDir = path.resolve(__dirname, '../../packages/core');

    console.log(
      `[TEST] ToolRegistry instanceId: ${(ToolRegistry as any).instanceId}`
    );

    // Get all possible tool IDs from the enum
    const allPossibleTools = ToolRegistry.getAvailableIds();

    // We'll filter for tools we know are implemented in this workspace
    const implementedTools = [
      ToolName.PatternDetect,
      ToolName.ContextAnalyzer,
      ToolName.NamingConsistency,
      ToolName.AiSignalClarity,
      ToolName.AgentGrounding,
      ToolName.TestabilityIndex,
      ToolName.DocDrift,
      ToolName.DependencyHealth,
      ToolName.ChangeAmplification,
    ];

    const results = await analyzeUnified({
      rootDir,
      tools: implementedTools,
      exclude: ['**/node_modules/**', '**/dist/**'],
    });

    expect(results).toBeDefined();
    console.log('DEBUG: results.summary.toolsRun:', results.summary.toolsRun);
    console.log('DEBUG: results keys:', Object.keys(results));

    // Ensure all tools were at least attempted
    for (const toolId of implementedTools) {
      expect(results.summary.toolsRun).toContain(toolId);
      expect((results as any)[toolId]).toBeDefined();

      // Tier 2 Validation: Verify each spoke's output matches the contract
      const validation = validateSpokeOutput(toolId, (results as any)[toolId]);
      if (!validation.valid) {
        console.error(
          `❌ Tool '${toolId}' failed contract validation:`,
          validation.errors
        );
      }
      expect(validation.valid).toBe(true);
    }

    // Run scoring to get the full report
    const scoring = await scoreUnified(results, { rootDir });

    expect(scoring.overall).toBeGreaterThanOrEqual(0);
    expect(scoring.overall).toBeLessThanOrEqual(100);
    expect(scoring.breakdown.length).toBe(results.summary.toolsRun.length);

    // Ensure each breakdown matches a tool that was run
    scoring.breakdown.forEach((toolScore) => {
      expect(results.summary.toolsRun).toContain(toolScore.toolName);
    });
  }, 60000); // 60s timeout for all tools
});
