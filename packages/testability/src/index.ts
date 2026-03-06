import { ToolRegistry } from '@aiready/core';
import { TestabilityProvider } from './provider';

// Register with global registry
ToolRegistry.register(TestabilityProvider);

export { analyzeTestability } from './analyzer';
export { calculateTestabilityScore } from './scoring';
export { TestabilityProvider };
export type {
  TestabilityOptions,
  TestabilityReport,
  TestabilityIssue,
} from './types';
