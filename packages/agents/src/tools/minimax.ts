/**
 * Configuration for MiniMax M2.7 to enable its full potential.
 */
export const MIN_MAX_M27_CONFIG = {
  model: 'anthropic/MiniMax-M2.7',
  baseUrl: 'https://api.minimax.io/anthropic',
};

/**
 * Helper to get the MiniMax-optimized agent configuration.
 */
export function getMiniMaxAgentConfig(baseConfig: any) {
  return {
    ...baseConfig,
    model: MIN_MAX_M27_CONFIG.model,
    // Note: In Mastra, we might need a custom provider to pass extraBody
    // if the standard OpenAI provider doesn't support it directly.
  };
}
