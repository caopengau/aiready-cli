import { ToolRegistry } from '@aiready/core';
import { ConsistencyProvider } from './provider';

// Register with global registry
ToolRegistry.register(ConsistencyProvider);

export { analyzeConsistency } from './analyzer';
export { analyzeNamingAST } from './analyzers/naming-ast';
export { analyzeNaming } from './analyzers/naming'; // Legacy regex version
export { detectNamingConventions } from './analyzers/naming-constants';
export { analyzePatterns } from './analyzers/patterns';
export { calculateConsistencyScore } from './scoring';
export { ConsistencyProvider };
export type {
  ConsistencyOptions,
  ConsistencyReport,
  ConsistencyIssue,
  NamingIssue,
  PatternIssue,
  ArchitectureIssue,
} from './types';
