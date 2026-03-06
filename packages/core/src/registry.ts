import { ToolName } from './types/schema';
import { ToolProvider } from './types/contract';

/**
 * AIReady Tool Registry
 *
 * Central registry for all analysis tools. Decouples the CLI from
 * individual tool packages and allows for easier extension.
 */
export class ToolRegistry {
  private static getProviders(): Map<ToolName, ToolProvider> {
    const g = globalThis as any;
    if (!g.__AIRE_TOOL_REGISTRY__) {
      g.__AIRE_TOOL_REGISTRY__ = new Map<ToolName, ToolProvider>();
    }
    return g.__AIRE_TOOL_REGISTRY__;
  }

  public static instanceId: number = globalThis.Math.random();

  /**
   * Register a new tool provider.
   */
  static register(provider: ToolProvider): void {
    console.log(
      `[ToolRegistry#${this.instanceId}] Registering tool: ${provider.id} (${provider.alias.join(', ')})`
    );
    this.getProviders().set(provider.id, provider);
  }

  /**
   * Get a provider by its canonical ID.
   */
  static get(id: ToolName): ToolProvider | undefined {
    return this.getProviders().get(id);
  }

  /**
   * Get a provider by name or alias.
   */
  static find(nameOrAlias: string): ToolProvider | undefined {
    const providers = this.getProviders();
    const exact = providers.get(nameOrAlias as ToolName);
    if (exact) return exact;

    for (const p of providers.values()) {
      if (p.alias.includes(nameOrAlias)) return p;
    }
    return undefined;
  }

  /**
   * Get all registered tool providers.
   */
  static getAll(): ToolProvider[] {
    return Array.from(this.getProviders().values());
  }

  /**
   * Get all available tool IDs from the ToolName enum.
   */
  static getAvailableIds(): ToolName[] {
    return Object.values(ToolName).filter(
      (v) => typeof v === 'string'
    ) as ToolName[];
  }

  /**
   * Clear the registry (primarily for testing).
   */
  static clear(): void {
    this.getProviders().clear();
  }
}
