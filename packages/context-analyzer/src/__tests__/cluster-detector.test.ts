import { describe, it, expect } from 'vitest';
import { detectModuleClusters } from '../cluster-detector';
import { DependencyGraph } from '../types';

describe('Cluster Detector', () => {
  it('should group files by domain into clusters', () => {
    const graph: DependencyGraph = {
      nodes: new Map([
        [
          'src/auth/login.ts',
          {
            file: 'src/auth/login.ts',
            imports: [],
            exports: [
              { name: 'login', type: 'function', inferredDomain: 'auth' },
            ],
            tokenCost: 1000,
            linesOfCode: 50,
          },
        ],
        [
          'src/auth/logout.ts',
          {
            file: 'src/auth/logout.ts',
            imports: [],
            exports: [
              { name: 'logout', type: 'function', inferredDomain: 'auth' },
            ],
            tokenCost: 500,
            linesOfCode: 20,
          },
        ],
        [
          'src/user/profile.ts',
          {
            file: 'src/user/profile.ts',
            imports: [],
            exports: [
              { name: 'getProfile', type: 'function', inferredDomain: 'user' },
            ],
            tokenCost: 2000,
            linesOfCode: 100,
          },
        ],
      ]),
      edges: new Map(),
    };

    const clusters = detectModuleClusters(graph);

    // Should find 'auth' cluster (2 files), but skip 'user' (only 1 file)
    expect(clusters.length).toBe(1);
    expect(clusters[0].domain).toBe('auth');
    expect(clusters[0].files).toHaveLength(2);
    expect(clusters[0].totalTokens).toBe(1500);
  });

  it('should calculate fragmentation and suggest consolidation', () => {
    const graph: DependencyGraph = {
      nodes: new Map([
        [
          'src/auth/login.ts',
          {
            file: 'src/auth/login.ts',
            imports: ['lib/common.ts'],
            exports: [
              { name: 'login', type: 'function', inferredDomain: 'auth' },
            ],
            tokenCost: 1000,
            linesOfCode: 50,
          },
        ],
        [
          'src/utils/auth-helper.ts',
          {
            file: 'src/utils/auth-helper.ts',
            imports: ['lib/common.ts'],
            exports: [
              { name: 'helper', type: 'function', inferredDomain: 'auth' },
            ],
            tokenCost: 500,
            linesOfCode: 20,
          },
        ],
      ]),
      edges: new Map(),
    };

    const clusters = detectModuleClusters(graph);

    expect(clusters[0].domain).toBe('auth');
    // fragmentation should be high because they are in different directories
    expect(clusters[0].fragmentationScore).toBeGreaterThan(0.5);
    expect(
      clusters[0].suggestedStructure.consolidationPlan.length
    ).toBeGreaterThan(0);
    expect(clusters[0].suggestedStructure.consolidationPlan[0]).toContain(
      'Consolidate'
    );
  });

  it('should suggest boundary improvements for large domains', () => {
    const graph: DependencyGraph = {
      nodes: new Map([
        [
          'src/big/part1.ts',
          {
            file: 'src/big/part1.ts',
            imports: [],
            exports: [{ name: 'p1', type: 'function', inferredDomain: 'big' }],
            tokenCost: 15000,
            linesOfCode: 500,
          },
        ],
        [
          'src/big/part2.ts',
          {
            file: 'src/big/part2.ts',
            imports: [],
            exports: [{ name: 'p2', type: 'function', inferredDomain: 'big' }],
            tokenCost: 10000,
            linesOfCode: 400,
          },
        ],
      ]),
      edges: new Map(),
    };

    const clusters = detectModuleClusters(graph);

    expect(clusters[0].totalTokens).toBe(25000);
    expect(clusters[0].suggestedStructure.consolidationPlan).some((p) =>
      p.includes('Ensure clear sub-domain boundaries')
    );
  });
});
