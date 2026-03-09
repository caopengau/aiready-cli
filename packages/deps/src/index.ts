import { ToolRegistry } from '@aiready/core';
import { DepsProvider } from './provider';

// Register with global registry
ToolRegistry.register(DepsProvider);

export * from './types';
export * from './analyzer';
export * from './scoring';
export { DepsProvider };
