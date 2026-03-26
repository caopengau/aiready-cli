import {
  ToolRegistry,
  ToolName,
  initializeParsers,
  GLOBAL_INFRA_OPTIONS,
  COMMON_FINE_TUNING_OPTIONS,
} from '@aiready/core';
import type { UnifiedAnalysisOptions, UnifiedAnalysisResult } from './options';

/**
 * Mapping between ToolName and @aiready/ package names.
 */
export const TOOL_PACKAGE_MAP: Record<string, string> = {
  [ToolName.PatternDetect]: '@aiready/pattern-detect',
  [ToolName.ContextAnalyzer]: '@aiready/context-analyzer',
  [ToolName.NamingConsistency]: '@aiready/consistency',
  [ToolName.AiSignalClarity]: '@aiready/ai-signal-clarity',
  [ToolName.AgentGrounding]: '@aiready/agent-grounding',
  [ToolName.TestabilityIndex]: '@aiready/testability',
  [ToolName.DocDrift]: '@aiready/doc-drift',
  [ToolName.DependencyHealth]: '@aiready/deps',
  [ToolName.ChangeAmplification]: '@aiready/change-amplification',
  [ToolName.ContractEnforcement]: '@aiready/contract-enforcement',
  // Aliases handled by registry
  patterns: '@aiready/pattern-detect',
  duplicates: '@aiready/pattern-detect',
  context: '@aiready/context-analyzer',
  fragmentation: '@aiready/context-analyzer',
  consistency: '@aiready/consistency',
  'ai-signal': '@aiready/ai-signal-clarity',
  grounding: '@aiready/agent-grounding',
  testability: '@aiready/testability',
  'deps-health': '@aiready/deps',
  'change-amp': '@aiready/change-amplification',
  contract: '@aiready/contract-enforcement',
};

/**
 * AIReady Unified Analysis Orchestrator.
 * Handles the execution and coordination of multiple analysis tools.
 */
export class UnifiedOrchestrator {
  private registry: typeof ToolRegistry;

  /**
   * Initialize orchestrator with a tool registry.
   * Injection pattern helps with testability and AI readiness score.
   */
  constructor(registry: typeof ToolRegistry = ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Deeply sanitizes a configuration object.
   */
  public sanitizeConfig(obj: any): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

    const sanitized: any = {};
    const infraToStrip = [
      'rootDir',
      'onProgress',
      'progressCallback',
      'streamResults',
      'batchSize',
      'useSmartDefaults',
    ];

    for (const [key, value] of Object.entries(obj)) {
      if (infraToStrip.includes(key)) continue;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        sanitized[key] = this.sanitizeConfig(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Performs the unified analysis.
   */
  public async analyze(
    options: UnifiedAnalysisOptions
  ): Promise<UnifiedAnalysisResult> {
    // Initialize language parsers
    await initializeParsers();

    const startTime = Date.now();
    const requestedTools = options.tools ?? [
      'patterns',
      'context',
      'consistency',
    ];

    const result: UnifiedAnalysisResult = {
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        majorIssues: 0,
        totalFiles: 0,
        toolsRun: [],
        executionTime: 0,
        config: options,
        toolConfigs: {},
      },
    };

    for (const toolName of requestedTools) {
      let provider = this.registry.find(toolName);

      // Dynamic Loading
      if (!provider) {
        const packageName =
          TOOL_PACKAGE_MAP[toolName] ??
          (toolName.startsWith('@aiready/')
            ? toolName
            : `@aiready/${toolName}`);
        try {
          await import(packageName);
          provider = this.registry.find(toolName);
        } catch (err: any) {
          console.log(
            `❌ Failed to dynamically load tool ${toolName} (${packageName}):`,
            err.message
          );
        }
      }

      if (!provider) {
        console.warn(
          `⚠️  Warning: Tool provider for '${toolName}' not found. Skipping.`
        );
        continue;
      }

      try {
        const toolOptions: any = {
          rootDir: options.rootDir,
        };

        [...GLOBAL_INFRA_OPTIONS, ...COMMON_FINE_TUNING_OPTIONS].forEach(
          (key) => {
            if (key in options && key !== 'toolConfigs' && key !== 'tools') {
              toolOptions[key] = (options as any)[key];
            }
          }
        );

        if (options.toolConfigs?.[provider.id]) {
          Object.assign(toolOptions, options.toolConfigs[provider.id]);
        } else if (
          options.tools &&
          !Array.isArray(options.tools) &&
          typeof options.tools === 'object' &&
          (options.tools as any)[provider.id]
        ) {
          Object.assign(toolOptions, (options.tools as any)[provider.id]);
        }

        toolOptions.onProgress = (
          processed: number,
          total: number,
          msg: string
        ) => {
          if (options.progressCallback) {
            options.progressCallback({
              tool: provider!.id,
              processed,
              total,
              message: msg,
            });
          }
        };

        const output = await provider.analyze(toolOptions);

        if (output.metadata) {
          output.metadata.config = this.sanitizeConfig(toolOptions);
        }

        if (options.progressCallback) {
          options.progressCallback({ tool: provider.id, data: output });
        }

        result[provider.id] = output;
        result.summary.toolsRun.push(provider.id);

        const toolConfig =
          output.summary?.config ?? output.metadata?.config ?? toolOptions;
        result.summary.toolConfigs![provider.id] =
          this.sanitizeConfig(toolConfig);

        const toolFiles =
          output.summary?.totalFiles ?? output.summary?.filesAnalyzed ?? 0;
        if (toolFiles > result.summary.totalFiles) {
          result.summary.totalFiles = toolFiles;
        }

        const issueCount = output.results.reduce(
          (sum: number, file: any) => sum + (file.issues?.length ?? 0),
          0
        );
        result.summary.totalIssues += issueCount;
      } catch (err) {
        console.error(`❌ Error running tool '${provider.id}':`, err);
      }
    }

    result.summary.config = this.sanitizeConfig({
      scan: {
        tools: requestedTools,
        include: options.include,
        exclude: options.exclude,
      },
      tools: result.summary.toolConfigs,
    });

    result.summary.executionTime = Date.now() - startTime;

    this.applyLegacyKeys(result);
    return result;
  }

  private applyLegacyKeys(result: UnifiedAnalysisResult) {
    const keyMappings: Record<string, string[]> = {
      'pattern-detect': ['patternDetect', 'patterns'],
      'context-analyzer': ['contextAnalyzer', 'context'],
      'naming-consistency': ['namingConsistency', 'consistency'],
      'ai-signal-clarity': ['aiSignalClarity'],
      'agent-grounding': ['agentGrounding'],
      'testability-index': ['testabilityIndex', 'testability'],
      'doc-drift': ['docDrift'],
      'dependency-health': ['dependencyHealth', 'deps'],
      'change-amplification': ['changeAmplification'],
      'contract-enforcement': ['contractEnforcement', 'contract'],
    };

    for (const [kebabKey, aliases] of Object.entries(keyMappings)) {
      if (result[kebabKey]) {
        for (const alias of aliases) {
          result[alias] = result[kebabKey];
        }
      }
    }
  }
}

/**
 * Backward compatible wrapper for the unified analysis orchestrator.
 */
export async function analyzeUnified(
  options: UnifiedAnalysisOptions
): Promise<UnifiedAnalysisResult> {
  const orchestrator = new UnifiedOrchestrator(ToolRegistry);
  return orchestrator.analyze(options);
}
