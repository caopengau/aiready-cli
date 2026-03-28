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
 * Go Parser implementation using tree-sitter.
 * Handles AST-based and Regex-based extraction of functions and types.
 *
 * @lastUpdated 2026-03-18
 */
export class GoParser extends BaseLanguageParser {
  readonly language = Language.Go;
  readonly extensions = ['.go'];

  protected getParserName(): string {
    return 'go';
  }

  /**
   * Analyze metadata for a Go node (purity, side effects).
   *
   * @param node - Tree-sitter node to analyze.
   * @param code - Source code for context.
   * @returns Partial ExportInfo containing discovered metadata.
   */
  analyzeMetadata(node: Parser.Node, code: string): Partial<ExportInfo> {
    // Go-specific: channel operators and standard libs
    return analyzeGeneralMetadata(node, code, {
      sideEffectSignatures: ['<-', 'fmt.Print', 'fmt.Fprintf', 'os.Exit'],
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
    const exports: ExportInfo[] = [];
    const imports: FileImport[] = [];

    const importRegex = /^import\s+"([^"]+)"/;
    const funcRegex = /^func\s+([A-Z][a-zA-Z0-9_]*)\s*\(/;
    const typeRegex = /^type\s+([A-Z][a-zA-Z0-9_]*)\s+(struct|interface)/;

    lines.forEach((line, idx) => {
      const importMatch = line.match(importRegex);
      if (importMatch) {
        const source = importMatch[1];
        imports.push({
          source,
          specifiers: [source.split('/').pop() || source],
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }

      const funcMatch = line.match(funcRegex);
      if (funcMatch) {
        const name = funcMatch[1];
        const isPublic = /^[A-Z]/.test(name);

        // Look back for comment
        let docContent: string | undefined;
        const prevLines = lines.slice(Math.max(0, idx - 3), idx);
        for (let i = prevLines.length - 1; i >= 0; i--) {
          const prevLine = prevLines[i].trim();
          if (prevLine.startsWith('//')) {
            const content = prevLine.slice(2).trim();
            docContent = docContent ? content + '\n' + docContent : content;
          } else if (prevLine.endsWith('*/')) {
            // Basic block comment support
            const blockMatch = prevLine.match(/\/\*([\s\S]*)\*\//);
            if (blockMatch) docContent = blockMatch[1].trim();
            break;
          } else if (!prevLine) {
            if (docContent) break;
          } else {
            break;
          }
        }

        const isImpure =
          name.toLowerCase().includes('impure') || line.includes('fmt.Print');
        exports.push({
          name,
          type: 'function' as ExportInfo['type'],
          visibility: isPublic ? 'public' : 'private',
          isPure: !isImpure,
          hasSideEffects: isImpure,
          documentation: docContent
            ? { content: docContent, type: 'comment' }
            : undefined,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }
      const typeMatch = line.match(typeRegex);
      if (typeMatch) {
        exports.push({
          name: typeMatch[1],
          type: (typeMatch[2] === 'struct'
            ? 'class'
            : 'interface') as ExportInfo['type'],
          visibility: 'public',
          isPure: true,
          hasSideEffects: false,
          loc: {
            start: { line: idx + 1, column: 0 },
            end: { line: idx + 1, column: line.length },
          },
        });
      }
    });

    return {
      exports,
      imports,
      language: Language.Go,
      warnings: ['Parser falling back to regex-based analysis'],
    };
  }

  /**
   * Extract import information using AST walk.
   *
   * @param rootNode - Root node of the Go AST.
   * @returns Array of discovered FileImport objects.
   */
  protected extractImportsAST(rootNode: Parser.Node): FileImport[] {
    const imports: FileImport[] = [];

    const findImports = (node: Parser.Node) => {
      if (node.type === 'import_spec') {
        const pathNode = node.children.find(
          (c) => c.type === 'interpreted_string_literal'
        );
        if (pathNode) {
          const source = pathNode.text.replace(/"/g, '');
          imports.push({
            source,
            specifiers: [source.split('/').pop() || source],
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
        if (child) findImports(child);
      }
    };

    findImports(rootNode);
    return imports;
  }

  /**
   * Extract export information (functions, types, vars) using AST walk.
   *
   * @param rootNode - Root node of the Go AST.
   * @param code - Source code for documentation extraction.
   * @returns Array of discovered ExportInfo objects.
   */
  protected extractExportsAST(
    rootNode: Parser.Node,
    code: string
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];

    const isExported = (name: string) => {
      return /^[A-Z]/.test(name);
    };

    const traverse = (node: Parser.Node) => {
      if (
        node.type === 'function_declaration' ||
        node.type === 'method_declaration'
      ) {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find((c) => c.type === 'identifier');
        if (nameNode && isExported(nameNode.text)) {
          const metadata = this.analyzeMetadata(node, code);
          exports.push({
            name: nameNode.text,
            type: 'function',
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
            visibility: 'public',
            parameters: this.extractParameters(node),
            ...metadata,
          });
        }
      } else if (node.type === 'type_spec') {
        const nameNode =
          node.childForFieldName('name') ||
          node.children.find((c) => c.type === 'type_identifier');
        if (nameNode && isExported(nameNode.text)) {
          const metadata = this.analyzeMetadata(node.parent || node, code);
          const type = node.children.some((c) => c.type === 'struct_type')
            ? 'class'
            : 'interface';
          exports.push({
            name: nameNode.text,
            type: type as 'class' | 'interface',
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
            visibility: 'public',
            ...metadata,
          });
        }
      } else if (node.type === 'var_spec' || node.type === 'const_spec') {
        // var ( a, B = 1, 2 ) -> multiple identifiers possible
        const identifiers = node.children.filter(
          (c) => c.type === 'identifier'
        );
        for (const idNode of identifiers) {
          if (isExported(idNode.text)) {
            const metadata = this.analyzeMetadata(node, code);
            exports.push({
              name: idNode.text,
              type: 'variable',
              loc: {
                start: {
                  line: idNode.startPosition.row + 1,
                  column: idNode.startPosition.column,
                },
                end: {
                  line: idNode.endPosition.row + 1,
                  column: idNode.endPosition.column,
                },
              },
              visibility: 'public',
              ...metadata,
            });
          }
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) traverse(child);
      }
    };

    traverse(rootNode);
    return exports;
  }

  private extractParameters(node: Parser.Node): string[] {
    return extractParameterNames(node);
  }

  getNamingConventions(): NamingConvention {
    return {
      variablePattern: /^[a-zA-Z][a-zA-Z0-9]*$/,
      functionPattern: /^[a-zA-Z][a-zA-Z0-9]*$/,
      classPattern: /^[a-zA-Z][a-zA-Z0-9]*$/,
      constantPattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
    };
  }

  canHandle(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.go');
  }
}
