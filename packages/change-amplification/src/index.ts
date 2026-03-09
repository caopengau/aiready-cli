import { ToolRegistry } from '@aiready/core';
import { ChangeAmplificationProvider } from './provider';

// Register with global registry
ToolRegistry.register(ChangeAmplificationProvider);

export { analyzeChangeAmplification } from './analyzer';
export { calculateChangeAmplificationScore } from './scoring';
export { ChangeAmplificationProvider };
export type {
  ChangeAmplificationOptions,
  ChangeAmplificationReport,
  ChangeAmplificationIssue,
  FileChangeAmplificationResult,
} from './types';
