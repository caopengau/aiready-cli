/**
 * Language-agnostic AST and parser interfaces for multi-language support
 *
 * This module provides abstractions for parsing different programming languages
 * while maintaining a consistent interface for analysis tools.
 */

import { FileImport, SourceRange, SourceLocation } from './ast';

/**
 * Supported programming languages
 */
export enum Language {
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  Python = 'python',
  Java = 'java',
  Go = 'go',
  Rust = 'rust',
  CSharp = 'csharp',
}

/**
 * File extensions mapped to languages
 */
export const LANGUAGE_EXTENSIONS: Record<string, Language> = {
  '.ts': Language.TypeScript,
  '.tsx': Language.TypeScript,
  '.js': Language.JavaScript,
  '.jsx': Language.JavaScript,
  '.py': Language.Python,
  '.java': Language.Java,
  '.go': Language.Go,
  '.rs': Language.Rust,
  '.cs': Language.CSharp,
};

/**
 * Common AST node type (language-agnostic)
 */
export interface CommonASTNode {
  type: string;
  loc?: SourceRange;
  // Language-specific data can be stored here
  raw?: any;
}

/**
 * Export information (function, class, variable, etc.)
 */
export interface ExportInfo {
  name: string;
  type:
    | 'function'
    | 'class'
    | 'const'
    | 'type'
    | 'interface'
    | 'default'
    | 'variable'
    | 'all';
  loc?: SourceRange;
  /** Imports used within this export */
  imports?: string[];
  /** Dependencies on other exports in same file */
  dependencies?: string[];
  /** TypeScript types referenced */
  typeReferences?: string[];
  /** For methods: parent class name */
  parentClass?: string;
  /** For functions/methods: parameters */
  parameters?: string[];
  /** For classes/interfaces: number of methods and properties */
  methodCount?: number;
  propertyCount?: number;
  /** Visibility (public, private, protected) */
  visibility?: 'public' | 'private' | 'protected';
  /** Whether the value is a primitive (string, number, boolean) */
  isPrimitive?: boolean;
  /** Behavioral metadata for advanced metrics */
  isPure?: boolean;
  hasSideEffects?: boolean;
  /** Whether the export has explicit type annotations (TS only) */
  isTyped?: boolean;
  /** Inferred domain/area this export belongs to (e.g., "auth", "database") */
  inferredDomain?: string;
  /** Associated documentation */
  documentation?: {
    content: string;
    type: 'jsdoc' | 'docstring' | 'comment' | 'xml-doc';
    loc?: SourceRange;
    isStale?: boolean;
  };
}

/**
 * Parse result containing exports and imports
 */
export interface ParseResult {
  exports: ExportInfo[];
  imports: FileImport[];
  /** Language of the parsed file */
  language: Language;
  /** Any parse warnings (non-fatal) */
  warnings?: string[];
}

/**
 * Naming convention rules per language
 */
export interface NamingConvention {
  /** Allowed variable naming patterns */
  variablePattern: RegExp;
  /** Allowed function naming patterns */
  functionPattern: RegExp;
  /** Allowed class naming patterns */
  classPattern: RegExp;
  /** Allowed constant naming patterns */
  constantPattern: RegExp;
  /** Allowed type naming patterns */
  typePattern?: RegExp;
  /** Allowed interface naming patterns */
  interfacePattern?: RegExp;
  /** Language-specific exceptions (e.g., __init__ in Python) */
  exceptions?: string[];
}

/**
 * Language-specific configuration
 */
export interface LanguageConfig {
  language: Language;
  /** File extensions for this language */
  extensions: string[];
  /** Naming conventions */
  namingConventions: NamingConvention;
  /** Common abbreviations allowed */
  allowedAbbreviations?: string[];
  /** Language-specific keywords to ignore */
  keywords?: string[];
}

/**
 * Abstract interface for language parsers
 * Each language implementation should implement this interface
 */
export interface LanguageParser {
  /** Language this parser handles */
  readonly language: Language;

  /** File extensions this parser supports */
  readonly extensions: string[];

  /**
   * Parse source code and extract structure
   * @param code - Source code to parse
   * @param filePath - Path to the file (for context)
   * @returns Parse result with exports and imports
   * @throws ParseError if code has syntax errors
   */
  parse(code: string, filePath: string): ParseResult;

  /**
   * Get naming conventions for this language
   */
  getNamingConventions(): NamingConvention;

  /**
   * Initialize the parser (e.g. load WASM)
   */
  initialize(): Promise<void>;

  /**
   * Check if this parser can handle a file
   * @param filePath - File path to check
   */
  canHandle(filePath: string): boolean;

  /**
   * Get the raw AST for advanced querying
   * @param code - Source code to parse
   * @param filePath - Path to the file
   */
  getAST(code: string, filePath: string): Promise<any>;

  /**
   * Analyze structural metadata for a node (e.g. purity)
   * @param node - The AST node to analyze (language specific)
   * @param code - The original source code
   */
  analyzeMetadata(node: any, code: string): Partial<ExportInfo>;
}

/**
 * Parser error with location information
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly loc?: SourceLocation
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Statistics about parsed code
 */
export interface ParseStatistics {
  language: Language;
  filesAnalyzed: number;
  totalExports: number;
  totalImports: number;
  parseErrors: number;
  warnings: number;
}

export { SourceLocation, SourceRange };
