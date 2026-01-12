import { describe, it, expect } from 'vitest';
import {
  buildDependencyGraph,
  calculateImportDepth,
  getTransitiveDependencies,
  calculateContextBudget,
  detectCircularDependencies,
  calculateCohesion,
  calculateFragmentation,
} from '../analyzer';

describe('buildDependencyGraph', () => {
  it('should build a basic dependency graph', () => {
    const files = [
      {
        file: 'a.ts',
        content: `
export const a = 1;
        `,
      },
      {
        file: 'b.ts',
        content: `
import { a } from './a';
export const b = a + 1;
        `,
      },
    ];

    const graph = buildDependencyGraph(files);

    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.get('b.ts')?.has('./a')).toBe(true);
  });
});

describe('calculateImportDepth', () => {
  it('should calculate import depth correctly', () => {
    const files = [
      { file: 'a.ts', content: 'export const a = 1;' },
      { file: 'b.ts', content: 'import { a } from "a.ts";\nexport const b = a;' },
      { file: 'c.ts', content: 'import { b } from "b.ts";\nexport const c = b;' },
    ];

    const graph = buildDependencyGraph(files);

    expect(calculateImportDepth('a.ts', graph)).toBe(0);
    expect(calculateImportDepth('b.ts', graph)).toBe(1);
    expect(calculateImportDepth('c.ts', graph)).toBe(2);
  });

  it('should handle circular dependencies gracefully', () => {
    const files = [
      { file: 'a.ts', content: 'import { b } from "./b";\nexport const a = 1;' },
      { file: 'b.ts', content: 'import { a } from "./a";\nexport const b = 2;' },
    ];

    const graph = buildDependencyGraph(files);

    // Should not infinite loop
    const depth = calculateImportDepth('a.ts', graph);
    expect(depth).toBeGreaterThanOrEqual(0);
  });
});

describe('getTransitiveDependencies', () => {
  it('should get all transitive dependencies', () => {
    const files = [
      { file: 'a.ts', content: 'export const a = 1;' },
      { file: 'b.ts', content: 'import { a } from "a.ts";\nexport const b = a;' },
      { file: 'c.ts', content: 'import { b } from "b.ts";\nexport const c = b;' },
    ];

    const graph = buildDependencyGraph(files);
    const deps = getTransitiveDependencies('c.ts', graph);

    expect(deps).toContain('b.ts');
    expect(deps).toContain('a.ts');
    expect(deps.length).toBe(2);
  });
});

describe('calculateContextBudget', () => {
  it('should calculate total token cost including dependencies', () => {
    const files = [
      { file: 'a.ts', content: 'export const a = 1;'.repeat(10) }, // ~40 tokens
      { file: 'b.ts', content: 'import { a } from "./a";\nexport const b = a;'.repeat(10) }, // ~60 tokens
    ];

    const graph = buildDependencyGraph(files);
    const budget = calculateContextBudget('b.ts', graph);

    // Should include both files' tokens
    expect(budget).toBeGreaterThan(80);
  });
});

describe('detectCircularDependencies', () => {
  it('should detect circular dependencies', () => {
    const files = [
      { file: 'a.ts', content: 'import { b } from "b.ts";\nexport const a = 1;' },
      { file: 'b.ts', content: 'import { a } from "a.ts";\nexport const b = 2;' },
    ];

    const graph = buildDependencyGraph(files);
    const cycles = detectCircularDependencies(graph);

    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should return empty for no circular dependencies', () => {
    const files = [
      { file: 'a.ts', content: 'export const a = 1;' },
      { file: 'b.ts', content: 'import { a } from "a.ts";\nexport const b = a;' },
    ];

    const graph = buildDependencyGraph(files);
    const cycles = detectCircularDependencies(graph);

    expect(cycles.length).toBe(0);
  });
});

describe('calculateCohesion', () => {
  it('should return 1 for single export', () => {
    const exports = [{ name: 'foo', type: 'function' as const, inferredDomain: 'user' }];
    expect(calculateCohesion(exports)).toBe(1);
  });

  it('should return high cohesion for related exports', () => {
    const exports = [
      { name: 'getUser', type: 'function' as const, inferredDomain: 'user' },
      { name: 'updateUser', type: 'function' as const, inferredDomain: 'user' },
      { name: 'deleteUser', type: 'function' as const, inferredDomain: 'user' },
    ];

    const cohesion = calculateCohesion(exports);
    expect(cohesion).toBeGreaterThan(0.9);
  });

  it('should return low cohesion for mixed exports', () => {
    const exports = [
      { name: 'getUser', type: 'function' as const, inferredDomain: 'user' },
      { name: 'getOrder', type: 'function' as const, inferredDomain: 'order' },
      { name: 'parseConfig', type: 'function' as const, inferredDomain: 'config' },
    ];

    const cohesion = calculateCohesion(exports);
    expect(cohesion).toBeLessThan(0.5);
  });
});

describe('calculateFragmentation', () => {
  it('should return 0 for single file', () => {
    const files = ['src/user/user.ts'];
    expect(calculateFragmentation(files, 'user')).toBe(0);
  });

  it('should return 0 for files in same directory', () => {
    const files = ['src/user/get.ts', 'src/user/update.ts'];
    expect(calculateFragmentation(files, 'user')).toBe(0);
  });

  it('should return high fragmentation for scattered files', () => {
    const files = [
      'src/user/get.ts',
      'src/api/user.ts',
      'src/services/user.ts',
      'src/helpers/user.ts',
    ];

    const fragmentation = calculateFragmentation(files, 'user');
    expect(fragmentation).toBeGreaterThan(0.8);
  });
});
