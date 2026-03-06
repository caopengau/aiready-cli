import { ToolRegistry } from '@aiready/core';
import { AgentGroundingProvider } from './provider';

// Register with global registry
ToolRegistry.register(AgentGroundingProvider);

export { analyzeAgentGrounding } from './analyzer';
export { calculateGroundingScore } from './scoring';
export { AgentGroundingProvider };
export type {
  AgentGroundingOptions,
  AgentGroundingReport,
  AgentGroundingIssue,
} from './types';
