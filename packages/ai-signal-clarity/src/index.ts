import { ToolRegistry } from '@aiready/core';
import { AiSignalClarityProvider } from './provider';

// Register with global registry
ToolRegistry.register(AiSignalClarityProvider);

export { analyzeAiSignalClarity } from './analyzer';
export { calculateAiSignalClarityScore } from './scoring';
export { scanFile } from './scanner';
export { AiSignalClarityProvider };
export type {
  AiSignalClarityOptions,
  AiSignalClarityReport,
  AiSignalClarityIssue,
  FileAiSignalClarityResult,
} from './types';
