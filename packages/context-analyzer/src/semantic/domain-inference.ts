import type {
  DependencyGraph,
  DomainAssignment,
  DomainSignals,
} from '../types';
import type { ExportInfo } from '@aiready/core';
import { singularize } from '../utils/string-utils';

/**
 * Calculate confidence score for a domain assignment based on signals.
 *
 * @param signals - The set of semantic signals detected for a domain.
 * @returns Numerical confidence score (0-1).
 */
export function calculateDomainConfidence(signals: DomainSignals): number {
  const weights = {
    coUsage: 0.35,
    typeReference: 0.3,
    exportName: 0.15,
    importPath: 0.1,
    folderStructure: 0.1,
  };
  let confidence = 0;
  if (signals.coUsage) confidence += weights.coUsage;
  if (signals.typeReference) confidence += weights.typeReference;
  if (signals.exportName) confidence += weights.exportName;
  if (signals.importPath) confidence += weights.importPath;
  if (signals.folderStructure) confidence += weights.folderStructure;
  return confidence;
}

/**
 * Infer domain from semantic analysis (co-usage + types) to identify logical modules.
 *
 * @param file - The file path to infer domain for.
 * @param exportName - The specific export identifier.
 * @param graph - The full dependency graph.
 * @param coUsageMatrix - Matrix of files frequently imported together.
 * @param typeGraph - Map of type references to files.
 * @param exportTypeRefs - Optional list of types referenced by the export.
 * @returns Array of potential domain assignments with confidence scores.
 */
export function inferDomainFromSemantics(
  file: string,
  exportName: string,
  graph: DependencyGraph,
  coUsageMatrix: Map<string, Map<string, number>>,
  typeGraph: Map<string, Set<string>>,
  exportTypeRefs?: string[]
): DomainAssignment[] {
  const domainSignals = new Map<string, DomainSignals>();

  const coUsages = coUsageMatrix.get(file) || new Map();
  const strongCoUsages = Array.from(coUsages.entries())
    .filter(([, count]) => count >= 3)
    .map(([coFile]) => coFile);

  for (const coFile of strongCoUsages) {
    const coNode = graph.nodes.get(coFile);
    if (coNode) {
      for (const exp of coNode.exports) {
        const expAny = exp as {
          inferredDomain?: string;
          domains?: Array<{ domain: string }>;
        };
        if (expAny.inferredDomain && expAny.inferredDomain !== 'unknown') {
          const domain = expAny.inferredDomain;
          if (!domainSignals.has(domain)) {
            domainSignals.set(domain, {
              coUsage: false,
              typeReference: false,
              exportName: false,
              importPath: false,
              folderStructure: false,
            });
          }
          domainSignals.get(domain)!.coUsage = true;
        }
      }
    }
  }

  if (exportTypeRefs) {
    for (const typeRef of exportTypeRefs) {
      const filesWithType = typeGraph.get(typeRef);
      if (filesWithType) {
        for (const typeFile of filesWithType) {
          if (typeFile === file) continue;
          const typeNode = graph.nodes.get(typeFile);
          if (typeNode) {
            for (const exp of typeNode.exports) {
              const expAny = exp as {
                inferredDomain?: string;
                domains?: Array<{ domain: string }>;
              };
              if (
                expAny.inferredDomain &&
                expAny.inferredDomain !== 'unknown'
              ) {
                const domain = expAny.inferredDomain;
                if (!domainSignals.has(domain)) {
                  domainSignals.set(domain, {
                    coUsage: false,
                    typeReference: false,
                    exportName: false,
                    importPath: false,
                    folderStructure: false,
                  });
                }
                domainSignals.get(domain)!.typeReference = true;
              }
            }
          }
        }
      }
    }
  }

  const assignments: DomainAssignment[] = [];
  for (const [domain, signals] of domainSignals) {
    const confidence = calculateDomainConfidence(signals);
    if (confidence >= 0.3) assignments.push({ domain, confidence, signals });
  }

  assignments.sort((a, b) => b.confidence - a.confidence);
  return assignments;
}

/**
 * Regex-based export extraction (legacy/fallback)
 *
 * @param content - Source code content.
 * @param filePath - Optional file path for domain context.
 * @param domainOptions - Optional overrides for domain keywords.
 * @param fileImports - Optional list of actual imports for semantic context.
 * @returns Array of extracted export information.
 */
export function extractExports(
  content: string,
  filePath?: string,
  domainOptions?: { domainKeywords?: string[] },
  fileImports?: string[]
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const patterns = [
    /export\s+function\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+const\s+(\w+)/g,
    /export\s+type\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
    /export\s+default/g,
  ];

  const types: ExportInfo['type'][] = [
    'function',
    'class',
    'const',
    'type',
    'interface',
    'default',
  ];

  patterns.forEach((pattern, index) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1] || 'default';
      const type = types[index];
      const inferredDomain = inferDomain(
        name,
        filePath,
        domainOptions,
        fileImports
      );
      exports.push({ name, type, inferredDomain } as any);
    }
  });

  return exports;
}

/**
 * Infer domain from name, path, or imports
 *
 * @param name - The identifier name to analyze.
 * @param filePath - Optional file path for structure context.
 * @param domainOptions - Optional overrides for domain keywords.
 * @param fileImports - Optional list of imports for domain context.
 * @returns The inferred domain name (string).
 */
export function inferDomain(
  name: string,
  filePath?: string,
  domainOptions?: { domainKeywords?: string[] },
  fileImports?: string[]
): string {
  const lower = name.toLowerCase();
  const tokens = Array.from(
    new Set(
      lower
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^a-z0-9]+/gi, ' ')
        .split(' ')
        .filter(Boolean)
    )
  );

  const defaultKeywords = [
    'authentication',
    'authorization',
    'payment',
    'invoice',
    'customer',
    'product',
    'order',
    'cart',
    'user',
    'admin',
    'repository',
    'controller',
    'service',
    'config',
    'model',
    'view',
    'auth',
  ];

  const domainKeywords = domainOptions?.domainKeywords?.length
    ? [...domainOptions.domainKeywords, ...defaultKeywords]
    : defaultKeywords;

  for (const keyword of domainKeywords) {
    if (tokens.includes(keyword)) return keyword;
  }

  for (const keyword of domainKeywords) {
    if (lower.includes(keyword)) return keyword;
  }

  if (fileImports) {
    for (const importPath of fileImports) {
      const segments = importPath.split('/');
      for (const segment of segments) {
        const segLower = segment.toLowerCase();
        const singularSegment = singularize(segLower);
        for (const keyword of domainKeywords) {
          if (
            singularSegment === keyword ||
            segLower === keyword ||
            segLower.includes(keyword)
          )
            return keyword;
        }
      }
    }
  }

  if (filePath) {
    const segments = filePath.split('/');
    for (const segment of segments) {
      const segLower = segment.toLowerCase();
      const singularSegment = singularize(segLower);
      for (const keyword of domainKeywords) {
        if (singularSegment === keyword || segLower === keyword) return keyword;
      }
    }
  }

  return 'unknown';
}
