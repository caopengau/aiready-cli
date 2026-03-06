import { ToolRegistry } from '@aiready/core';
import { DocDriftProvider } from './provider';

// Register with global registry
ToolRegistry.register(DocDriftProvider);

export * from './types';
export * from './analyzer';
export { DocDriftProvider };
