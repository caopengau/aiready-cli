import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import type { AIReadyConfig } from '../types';

const CONFIG_FILES = [
  'aiready.json',
  'aiready.config.json',
  '.aiready.json',
  '.aireadyrc.json',
  'aiready.config.js',
  '.aireadyrc.js'
];

export function loadConfig(rootDir: string): AIReadyConfig | null {
  for (const configFile of CONFIG_FILES) {
    const configPath = resolve(rootDir, configFile);

    if (existsSync(configPath)) {
      try {
        let config: AIReadyConfig;

        if (configFile.endsWith('.js')) {
          // For JS files, require them
          delete require.cache[require.resolve(configPath)]; // Clear cache
          config = require(configPath);
        } else {
          // For JSON files, parse them
          const content = readFileSync(configPath, 'utf-8');
          config = JSON.parse(content);
        }

        // Basic validation
        if (typeof config !== 'object' || config === null) {
          throw new Error('Config must be an object');
        }

        return config;
      } catch (error) {
        throw new Error(`Failed to load config from ${configPath}: ${error}`);
      }
    }
  }

  return null;
}

export function mergeConfigWithDefaults(
  userConfig: AIReadyConfig | null,
  defaults: any
): any {
  if (!userConfig) return defaults;

  const result = { ...defaults };

  // Merge scan options
  if (userConfig.scan) {
    if (userConfig.scan.include) result.include = userConfig.scan.include;
    if (userConfig.scan.exclude) result.exclude = userConfig.scan.exclude;
  }

  // Merge tool-specific options
  if (userConfig.tools) {
    for (const [toolName, toolConfig] of Object.entries(userConfig.tools)) {
      if (result[toolName] && typeof toolConfig === 'object' && toolConfig !== null) {
        result[toolName] = { ...result[toolName], ...toolConfig };
      }
    }
  }

  // Merge output preferences
  if (userConfig.output) {
    result.output = { ...result.output, ...userConfig.output };
  }

  return result;
}