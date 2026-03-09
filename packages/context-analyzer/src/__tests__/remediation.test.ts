import { describe, it, expect } from 'vitest';
import {
  getClassificationRecommendations,
  getGeneralRecommendations,
} from '../remediation';

describe('Remediation Logic', () => {
  describe('getClassificationRecommendations', () => {
    it('should return specific recommendations for barrel exports', () => {
      const recs = getClassificationRecommendations(
        'barrel-export',
        'index.ts',
        []
      );
      expect(recs[0]).toContain('Barrel export file detected');
    });

    it('should return specific recommendations for type definitions', () => {
      const recs = getClassificationRecommendations(
        'type-definition',
        'types.ts',
        []
      );
      expect(recs[0]).toContain('Type definition file');
    });

    it('should return general issues if classification is unknown', () => {
      const issues = ['High complexity'];
      const recs = getClassificationRecommendations(
        'unknown',
        'file.ts',
        issues
      );
      expect(recs).toEqual(issues);
    });
  });

  describe('getGeneralRecommendations', () => {
    const thresholds = {
      maxContextBudget: 10000,
      maxDepth: 5,
      minCohesion: 0.6,
      maxFragmentation: 0.5,
    };

    it('should identify high context budget as major severity', () => {
      const result = getGeneralRecommendations(
        {
          contextBudget: 15000,
          importDepth: 3,
          circularDeps: [],
          cohesionScore: 0.8,
          fragmentationScore: 0.2,
        },
        thresholds
      );

      expect(result.severity).toBe('major');
      expect(result.issues[0]).toContain('High context budget');
    });

    it('should identify circular dependencies as critical severity', () => {
      const result = getGeneralRecommendations(
        {
          contextBudget: 5000,
          importDepth: 3,
          circularDeps: [['a.ts', 'b.ts', 'a.ts']],
          cohesionScore: 0.8,
          fragmentationScore: 0.2,
        },
        thresholds
      );

      expect(result.severity).toBe('critical');
      expect(result.recommendations[0]).toContain('circular imports');
    });

    it('should identify low cohesion as minor severity', () => {
      const result = getGeneralRecommendations(
        {
          contextBudget: 5000,
          importDepth: 3,
          circularDeps: [],
          cohesionScore: 0.4,
          fragmentationScore: 0.2,
        },
        thresholds
      );

      expect(result.severity).toBe('minor');
      expect(result.issues[0]).toContain('Low cohesion score');
    });
  });
});
