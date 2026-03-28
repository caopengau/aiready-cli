import * as Parser from 'web-tree-sitter';
import {
  ExportInfo,
  Language,
  NamingConvention,
  ParseResult,
} from '../types/language';
import { FileImport } from '../types/ast';
import {
  analyzeGeneralMetadata,
  extractParameterNames,
} from './shared-parser-utils';

import { BaseLanguageParser } from './base-parser';

/**
 * C# Parser implementation using tree-sitter.
 * Supports AST-based and Regex-based extraction of namespace-scoped classes and methods.
 *
 * @lastUpdated 2026-03-18
 */
export class CSharpParser extends BaseLanguageParser {
  readonly language = Language.CSharp;
  readonly extensions = ['.cs'];

  protected getParserName(): string {
    return 'c_sharp';
  }

  /**
   * Analyze metadata for a C# node (purity, side effects).
   *
   * @param node - Tree-sitter node to analyze.
   * @param code - Source code for context.
   * @returns Partial ExportInfo containing discovered metadata.
   */
  analyzeMetadata(node: Parser.Node, code: string): Partial<ExportInfo> {
    // C# specific side-effect signatures
    return analyzeGeneralMetadata(node, code, {
      sideEffectSignatures: ['Console.Write', 'File.Write', 'Logging.'],
    });
  }

  /**
   * Fallback regex-based parsing when tree-sitter is unavailable.
   *
   * @param code - Source code content.
   * @returns Consolidated ParseResult.
   */
  protected parseRegex(code: string): ParseResult {
    const lines = code.split('\n');
    const exports: any[] = [];
    const imports: FileImport[] = [];

    const usingRegex = /^using\s+([a-zA-Z0-9_.]+);/;
    const classRegex = /^\s*(?:public\s+)?class\s+([a-zA-Z0-9_]+)/;
    const methodRegex =
      /^\s*(?:public|protected)\s+(?:static\s+)?[a-zA-Z0-9_.]+\s+([a-zA-Z0-9_]+)\s*\(/;

    let currentClassName = '';

    lines.forEach((line, idx) => {
      const usingMatch = line.match(usingRegex);
      if (usingMatch) {
        const source = usingMatch[1];
        imports.push({
          source,
          specifiers: [source.split('.').pop() || source],
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }

      const classMatch = line.match(classRegex);
      if (classMatch) {
        currentClassName = classMatch[1];
        exports.push({
          name: currentClassName,
          type: 'class',
          visibility: 'public',
          isPure: true,
          hasSideEffects: false,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }

      const methodMatch = line.match(methodRegex);
      if (methodMatch && currentClassName) {
        const name = methodMatch[1];
        const isImpure =
          name.toLowerCase().includes('impure') ||
          line.includes('Console.WriteLine');
        exports.push({
          name,
          type: 'function',
          parentClass: currentClassName,
          visibility: 'public',
          isPure: !isImpure,
          hasSideEffects: isImpure,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        } as unknown);
      }
    });

    return {
      exports,
      imports,
      language: Language.CSharp,
      warnings: ['Parser falling back to regex-based analysis'],
    };
  }

  /**
   * Extract import information (usings) using AST walk.
   *
   * @param rootNode - Root node of the C# AST.
   * @returns Array of discovered FileImport objects.
   */
  protected extractImportsAST(rootNode: Parser.Node): FileImport[] {
    const imports: FileImport[] = [];

    const findUsings = (node: Parser.Node) => {
      if (node.type === 'using_directive') {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find(
            (c) => c.type === 'qualified_name' || c.type === 'identifier'
          );
        if (nameNode) {
          const aliasNode = node.childForFieldName('alias');
          imports.push({
            source: nameNode.text,
            specifiers: aliasNode
              ? [aliasNode.text]
              : [nameNode.text.split('.').pop() || nameNode.text],
            loc: {
              start: {
                line: node.startPosition.row + 1,
                column: node.startPosition.column,
              },
              end: {
                line: node.endPosition.row + 1,
                column: node.endPosition.column,
              },
            },
          });
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) findUsings(child);
      }
    };

    findUsings(rootNode);
    return imports;
  }

  /**
   * Extract export information (classes, methods, properties) using AST walk.
   * Handles nested namespaces and classes.
   *
   * @param rootNode - Root node of the C# AST.
   * @param code - Source code for documentation extraction.
   * @returns Array of discovered ExportInfo objects.
   */
  protected extractExportsAST(
    rootNode: Parser.Node,
    code: string
  ): ExportInfo[] {
    const exports: any[] = [];

    const traverse = (
      node: Parser.Node,
      currentNamespace?: string,
      currentClass?: string
    ) => {
      let nextNamespace = currentNamespace;
      let nextClass = currentClass;

      if (
        node.type === 'namespace_declaration' ||
        node.type === 'file_scoped_namespace_declaration'
      ) {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find(
            (c) => c.type === 'identifier' || c.type === 'qualified_name'
          );
        if (nameNode) {
          nextNamespace = currentNamespace
            ? `${currentNamespace}.${nameNode.text}`
            : nameNode.text;
        }
      } else if (
        node.type === 'class_declaration' ||
        node.type === 'interface_declaration' ||
        node.type === 'enum_declaration' ||
        node.type === 'struct_declaration' ||
        node.type === 'record_declaration'
      ) {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find((c) => c.type === 'identifier');
        if (nameNode) {
          const modifiers = this.getModifiers(node);
          const isPublic =
            modifiers.includes('public') || modifiers.includes('protected');

          if (isPublic) {
            const metadata = this.analyzeMetadata(node, code);
            const nodeType = node.type.replace('_declaration', '');
            let exportType: any = 'class';
            if (
              nodeType === 'record' ||
              nodeType === 'struct' ||
              nodeType === 'enum'
            ) {
              exportType = 'class';
            } else if (
              nodeType === 'interface' ||
              nodeType === 'interface_declaration'
            ) {
              exportType = 'interface';
            }

            const fullName = nextClass
              ? `${nextClass}.${nameNode.text}`
              : nextNamespace
                ? `${nextNamespace}.${nameNode.text}`
                : nameNode.text;

            const exportItem: any = {
              name: fullName,
              type: exportType,
              loc: {
                start: {
                  line: node.startPosition.row + 1,
                  column: node.startPosition.column,
                },
                end: {
                  line: node.endPosition.row + 1,
                  column: node.endPosition.column,
                },
              },
              visibility: modifiers.includes('public') ? 'public' : 'protected',
              ...metadata,
            };
            exports.push(exportItem);
            nextClass = fullName;
          }
        }
      } else if (
        node.type === 'method_declaration' ||
        node.type === 'property_declaration'
      ) {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find((c) => c.type === 'identifier');
        if (nameNode) {
          const modifiers = this.getModifiers(node);
          const isPublic =
            modifiers.includes('public') || modifiers.includes('protected');

          if (isPublic) {
            const metadata = this.analyzeMetadata(node, code);
            const methodItem: any = {
              name: nameNode.text,
              type:
                node.type === 'method_declaration' ? 'function' : 'variable',
              parentClass: currentClass,
              loc: {
                start: {
                  line: node.startPosition.row + 1,
                  column: node.startPosition.column,
                },
                end: {
                  line: node.endPosition.row + 1,
                  column: node.endPosition.column,
                },
              },
              visibility: modifiers.includes('public') ? 'public' : 'protected',
              parameters:
                node.type === 'method_declaration'
                  ? this.extractParameters(node)
                  : undefined,
              ...metadata,
            };
            exports.push(methodItem);
          }
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) traverse(child, nextNamespace, nextClass);
      }
    };

    traverse(rootNode);
    return exports;
  }

  private getModifiers(node: Parser.Node): string[] {
    const modifiers: string[] = [];
    for (const child of node.children) {
      if (child.type === 'modifier') {
        modifiers.push(child.text);
      }
    }
    return modifiers;
  }

  private extractParameters(node: Parser.Node): string[] {
    return extractParameterNames(node);
  }

  getNamingConventions(): NamingConvention {
    return {
      variablePattern: /^[a-z][a-zA-Z0-9]*$/,
      functionPattern: /^[A-Z][a-zA-Z0-9]*$/,
      classPattern: /^[A-Z][a-zA-Z0-9]*$/,
      constantPattern: /^[A-Z][a-zA-Z0-9_]*$/,
    };
  }

  canHandle(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.cs');
  }
}
