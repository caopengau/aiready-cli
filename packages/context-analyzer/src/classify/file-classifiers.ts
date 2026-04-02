import { DependencyNode } from '../types';
import type { ExportInfo } from '@aiready/core';
import {
  BARREL_EXPORT_MIN_EXPORTS,
  BARREL_EXPORT_TOKEN_LIMIT,
  HANDLER_NAME_PATTERNS,
  SERVICE_NAME_PATTERNS,
  EMAIL_NAME_PATTERNS,
  PARSER_NAME_PATTERNS,
  SESSION_NAME_PATTERNS,
  NEXTJS_METADATA_EXPORTS,
  CONFIG_NAME_PATTERNS,
} from './classification-patterns';

/**
 * Detect if a file is a boilerplate barrel (architectural theater).
 * A boilerplate barrel re-exports from other sources without adding value.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file matches boilerplate barrel patterns.
 */
export function isBoilerplateBarrel(node: DependencyNode): boolean {
  const { exports, tokenCost } = node;
  if (!exports || exports.length === 0) return false;

  // 1. Must be purely re-exports
  const isPurelyReexports = exports.every((exp: ExportInfo) => !!exp.source);
  if (!isPurelyReexports) return false;

  // 2. Must be low local token cost (no actual logic)
  if (tokenCost > 500) return false;

  // 3. Detect "Architectural Theater"
  // If it re-exports everything from exactly ONE source, it's a pass-through
  const sources = new Set(exports.map((exp: ExportInfo) => exp.source));

  // Pattern: export * from '../actual'
  const isSingleSourcePassThrough = sources.size === 1;

  // Pattern: multi-file 1-to-1 re-exports that don't aggregate much
  // (e.g., 6 files each re-exporting from exactly one other file)
  const isMeaninglessAggregation = sources.size > 0 && sources.size < 3;

  return isSingleSourcePassThrough || isMeaninglessAggregation;
}

/**
 * Detect if a file is a barrel export (index.ts).
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file matches barrel export patterns.
 * @lastUpdated 2026-03-20
 */
export function isBarrelExport(node: DependencyNode): boolean {
  if (isBoilerplateBarrel(node)) return false; // Already handled by more specific check

  const { file, exports } = node;
  const fileName = file.split('/').pop()?.toLowerCase();

  const isIndexFile = fileName === 'index.ts' || fileName === 'index.js';
  const isSmallAndManyExports =
    node.tokenCost < BARREL_EXPORT_TOKEN_LIMIT &&
    (exports || []).length > BARREL_EXPORT_MIN_EXPORTS;

  const isReexportPattern =
    (exports || []).length >= BARREL_EXPORT_MIN_EXPORTS &&
    (exports || []).every((exp: ExportInfo) =>
      ['const', 'function', 'type', 'interface'].includes(exp.type)
    );

  return !!isIndexFile || !!isSmallAndManyExports || !!isReexportPattern;
}

/**
 * Detect if a file is primarily type definitions.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file contains primarily types or matches type paths.
 * @lastUpdated 2026-03-18
 */
export function isTypeDefinition(node: DependencyNode): boolean {
  const { file } = node;
  if (file.endsWith('.d.ts')) return true;

  const nodeExports = node.exports || [];
  const hasExports = nodeExports.length > 0;
  const areAllTypes =
    hasExports &&
    nodeExports.every(
      (exp: ExportInfo) => exp.type === 'type' || exp.type === 'interface'
    );

  const isTypePath = /\/(types|interfaces|models)\//i.test(file);
  return !!areAllTypes || (isTypePath && hasExports);
}

/**
 * Detect if a file is a utility module.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file path or name suggests a utility/helper role.
 * @lastUpdated 2026-03-18
 */
export function isUtilityModule(node: DependencyNode): boolean {
  const { file } = node;
  const isUtilPath = /\/(utils|helpers|util|helper)\//i.test(file);
  const fileName = file.split('/').pop()?.toLowerCase() || '';
  const isUtilName = /(utils\.|helpers\.|util\.|helper\.)/i.test(fileName);
  return isUtilPath || isUtilName;
}

/**
 * Detect if a file is a Lambda/API handler.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file serves as a coordination point for requests/lambdas.
 * @lastUpdated 2026-03-18
 */
export function isLambdaHandler(node: DependencyNode): boolean {
  const { file, exports } = node;
  const fileName = file.split('/').pop()?.toLowerCase() || '';

  const isHandlerName = HANDLER_NAME_PATTERNS.some((pattern: string) =>
    fileName.includes(pattern)
  );
  const isHandlerPath = /\/(handlers|lambdas|lambda|functions)\//i.test(file);
  const hasHandlerExport = (exports || []).some(
    (exp: ExportInfo) =>
      ['handler', 'main', 'lambdahandler'].includes(exp.name.toLowerCase()) ||
      exp.name.toLowerCase().endsWith('handler')
  );
  return isHandlerName || isHandlerPath || hasHandlerExport;
}

/**
 * Detect if a file is a service file.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file orchestrates logic or matches service patterns.
 * @lastUpdated 2026-03-18
 */
export function isServiceFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  const fileName = file.split('/').pop()?.toLowerCase() || '';

  const isServiceName = SERVICE_NAME_PATTERNS.some((pattern: string) =>
    fileName.includes(pattern)
  );
  const isServicePath = file.toLowerCase().includes('/services/');
  const hasServiceNamedExport = (exports || []).some((exp: ExportInfo) =>
    exp.name.toLowerCase().includes('service')
  );
  const hasClassExport = (exports || []).some(
    (exp: ExportInfo) => exp.type === 'class'
  );
  return (
    isServiceName || isServicePath || (hasServiceNamedExport && hasClassExport)
  );
}

/**
 * Detect if a file is an email template/layout.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file is used for rendering notifications or emails.
 * @lastUpdated 2026-03-18
 */
export function isEmailTemplate(node: DependencyNode): boolean {
  const { file, exports } = node;
  const fileName = file.split('/').pop()?.toLowerCase() || '';

  const isEmailName = EMAIL_NAME_PATTERNS.some((pattern: string) =>
    fileName.includes(pattern)
  );
  const isEmailPath = /\/(emails|mail|notifications)\//i.test(file);
  const hasTemplateFunction = (exports || []).some(
    (exp: ExportInfo) =>
      exp.type === 'function' &&
      (exp.name.toLowerCase().startsWith('render') ||
        exp.name.toLowerCase().startsWith('generate'))
  );
  return isEmailPath || isEmailName || hasTemplateFunction;
}

/**
 * Detect if a file is a parser/transformer.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file handles data conversion or serialization.
 * @lastUpdated 2026-03-18
 */
export function isParserFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  const fileName = file.split('/').pop()?.toLowerCase() || '';

  const isParserName = PARSER_NAME_PATTERNS.some((pattern: string) =>
    fileName.includes(pattern)
  );
  const isParserPath = /\/(parsers|transformers)\//i.test(file);
  const hasParseFunction = (exports || []).some(
    (exp: ExportInfo) =>
      exp.type === 'function' &&
      (exp.name.toLowerCase().startsWith('parse') ||
        exp.name.toLowerCase().startsWith('transform'))
  );
  return isParserName || isParserPath || hasParseFunction;
}

/**
 * Detect if a file is a session/state management file.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file manages application state or sessions.
 * @lastUpdated 2026-03-18
 */
export function isSessionFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  const fileName = file.split('/').pop()?.toLowerCase() || '';

  const isSessionName = SESSION_NAME_PATTERNS.some((pattern: string) =>
    fileName.includes(pattern)
  );
  const isSessionPath = /\/(sessions|state)\//i.test(file);
  const hasSessionExport = (exports || []).some((exp: ExportInfo) =>
    ['session', 'state', 'store'].some((pattern: string) =>
      exp.name.toLowerCase().includes(pattern)
    )
  );
  return isSessionName || isSessionPath || hasSessionExport;
}

/**
 * Detect if a file is a Next.js App Router page.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file is a Next.js page or metadata entry.
 * @lastUpdated 2026-03-18
 */
export function isNextJsPage(node: DependencyNode): boolean {
  const { file, exports } = node;
  const lowerPath = file.toLowerCase();
  const fileName = file.split('/').pop()?.toLowerCase() || '';

  const isInAppDir =
    lowerPath.includes('/app/') || lowerPath.startsWith('app/');
  if (!isInAppDir || (fileName !== 'page.tsx' && fileName !== 'page.ts'))
    return false;

  const hasDefaultExport = (exports || []).some(
    (exp: ExportInfo) => exp.type === 'default'
  );

  const hasNextJsExport = (exports || []).some((exp: ExportInfo) =>
    NEXTJS_METADATA_EXPORTS.includes(exp.name.toLowerCase())
  );

  return hasDefaultExport || hasNextJsExport;
}

/**
 * Detect if a file is a configuration or schema file.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file matches configuration, setting, or schema patterns.
 * @lastUpdated 2026-03-18
 */
export function isConfigFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  const lowerPath = file.toLowerCase();
  const fileName = file.split('/').pop()?.toLowerCase() || '';

  const isConfigName = CONFIG_NAME_PATTERNS.some((pattern: string) =>
    fileName.includes(pattern)
  );
  const isConfigPath = /\/(config|settings|schemas)\//i.test(lowerPath);
  const hasSchemaExport = (exports || []).some((exp: ExportInfo) =>
    ['schema', 'config', 'setting'].some((pattern: string) =>
      exp.name.toLowerCase().includes(pattern)
    )
  );

  return isConfigName || isConfigPath || hasSchemaExport;
}

/**
 * Detect if a file is part of a hub-and-spoke monorepo architecture.
 *
 * Many files spread across multiple packages (spokes) is intentional in
 * AIReady and shouldn't be penalized as heavily for fragmentation.
 *
 * @param node - The dependency node to analyze.
 * @returns True if the file path suggests it belongs to a spoke package.
 */
export function isHubAndSpokeFile(node: DependencyNode): boolean {
  const { file } = node;
  return /\/packages\/[a-zA-Z0-9-]+\/src\//.test(file);
}
