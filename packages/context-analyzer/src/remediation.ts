import type { FileClassification } from './types';

/**
 * Get classification-specific recommendations
 *
 * @param classification - The identified type of file (e.g., 'barrel-export', 'utility-module').
 * @param file - File path or identifier.
 * @param issues - Initial list of issues to supplement.
 * @returns Array of tailored recommendations.
 */
export function getClassificationRecommendations(
  classification: FileClassification,
  file: string,
  issues: string[]
): string[] {
  switch (classification) {
    case 'boilerplate-barrel':
      return [
        'Redundant indirection detected (architectural theater)',
        'Remove this pass-through barrel export to reduce cognitive load',
        'Consider combining into meaningful domain exports if necessary',
      ];
    case 'barrel-export':
      return [
        'Barrel export file detected - multiple domains are expected here',
        'Consider if this barrel export improves or hinders discoverability',
      ];
    case 'type-definition':
      return [
        'Type definition file - centralized types improve consistency',
        'Consider splitting if file becomes too large (>500 lines)',
      ];
    case 'cohesive-module':
      return [
        'Module has good cohesion despite its size',
        'Consider documenting the module boundaries for AI assistants',
      ];
    case 'utility-module':
      return [
        'Utility module detected - multiple domains are acceptable here',
        'Consider grouping related utilities by prefix or domain for better discoverability',
      ];
    case 'service-file':
      return [
        'Service file detected - orchestration of multiple dependencies is expected',
        'Consider documenting service boundaries and dependencies',
      ];
    case 'lambda-handler':
      return [
        'Lambda handler detected - coordination of services is expected',
        'Ensure handler has clear single responsibility',
      ];
    case 'email-template':
      return [
        'Email template detected - references multiple domains for rendering',
        'Template structure is cohesive by design',
      ];
    case 'parser-file':
      return [
        'Parser/transformer file detected - handles multiple data sources',
        'Consider documenting input/output schemas',
      ];
    case 'nextjs-page':
      return [
        'Next.js App Router page detected - metadata/JSON-LD/component pattern is cohesive',
        'Multiple exports (metadata, faqJsonLd, default) serve single page purpose',
      ];
    case 'spoke-module':
      return [
        'Spoke module detected - intentional monorepo separation is good for modularity',
        'Ensure this spoke only exports what is necessary for the hub or other spokes',
      ];
    case 'mixed-concerns':
      return [
        'Consider splitting this file by domain',
        'Identify independent responsibilities and extract them',
        'Review import dependencies to understand coupling',
      ];
    default:
      return issues;
  }
}

/**
 * Generate general context recommendations based on cross-tool metrics and thresholds.
 *
 * @param metrics - Object containing context budget, depth, circular dependencies, cohesion, and fragmentation.
 * @param thresholds - Configurable limits for each metric.
 * @returns Object with recommendations array, issues array, and overall severity level.
 */
export function getGeneralRecommendations(
  metrics: {
    contextBudget: number;
    importDepth: number;
    circularDeps: string[][];
    cohesionScore: number;
    fragmentationScore: number;
  },
  thresholds: {
    maxContextBudget: number;
    maxDepth: number;
    minCohesion: number;
    maxFragmentation: number;
  }
): {
  recommendations: string[];
  issues: string[];
  severity: any;
} {
  const recommendations: string[] = [];
  const issues: string[] = [];
  let severity: string = 'info';

  if (metrics.contextBudget > thresholds.maxContextBudget) {
    issues.push(
      `High context budget: ${Math.round(metrics.contextBudget / 1000)}k tokens`
    );
    recommendations.push(
      'Reduce dependencies or split the file to lower context window requirements'
    );
    severity = 'major';
  }

  if (metrics.importDepth > thresholds.maxDepth) {
    issues.push(`Deep import chain: ${metrics.importDepth} levels`);
    recommendations.push('Flatten the dependency graph by reducing nesting');
    if (severity !== 'critical') severity = 'major';
  }

  if (metrics.circularDeps.length > 0) {
    issues.push(
      `Circular dependencies detected: ${metrics.circularDeps.length}`
    );
    recommendations.push(
      'Refactor to remove circular imports (use dependency injection or interfaces)'
    );
    severity = 'critical';
  }

  if (metrics.cohesionScore < thresholds.minCohesion) {
    issues.push(`Low cohesion score: ${metrics.cohesionScore.toFixed(2)}`);
    recommendations.push(
      'Extract unrelated exports into separate domain-specific modules'
    );
    if (severity === 'info') severity = 'minor';
  }

  if (metrics.fragmentationScore > thresholds.maxFragmentation) {
    issues.push(
      `High domain fragmentation: ${metrics.fragmentationScore.toFixed(2)}`
    );
    recommendations.push(
      'Consolidate domain-related files into fewer directories'
    );
    if (severity === 'info') severity = 'minor';
  }

  return {
    recommendations,
    issues,
    severity: severity as 'critical' | 'major' | 'minor' | 'info',
  };
}
