/**
 * TypeScript/JavaScript Parser
 *
 * Parses TypeScript and JavaScript files using @typescript-eslint/typescript-estree
 */

import { parse, TSESTree } from '@typescript-eslint/typescript-estree';
import {
  Language,
  LanguageParser,
  ParseResult,
  ExportInfo,
  NamingConvention,
  ParseError,
} from '../types/language';
import { FileImport } from '../types/ast';

export class TypeScriptParser implements LanguageParser {
  readonly language = Language.TypeScript;
  readonly extensions = ['.ts', '.tsx', '.js', '.jsx'];

  async initialize(): Promise<void> {
    // Initialized synchronously via @typescript-eslint/typescript-estree
  }

  canHandle(filePath: string): boolean {
    return this.extensions.some((ext) => filePath.endsWith(ext));
  }

  async getAST(code: string, filePath: string): Promise<TSESTree.Program> {
    try {
      return parse(code, {
        filePath,
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: filePath.endsWith('x'),
      });
    } catch (error: unknown) {
      const err = error as Error & { lineNumber?: number; column?: number };
      throw new ParseError(err.message || 'Unknown error', filePath, {
        line: err.lineNumber || 1,
        column: err.column || 0,
      });
    }
  }

  parse(code: string, filePath: string): ParseResult {
    try {
      const ast = parse(code, {
        filePath,
        loc: true,
        range: true,
        tokens: true,
        comment: true,
        jsx: filePath.endsWith('x'),
      });

      const imports = this.extractImports(ast);
      const exports = this.extractExports(ast, code, filePath);

      return {
        exports,
        imports,
        language: this.language,
      };
    } catch (error: any) {
      throw new ParseError(error.message, filePath, {
        line: error.lineNumber || 1,
        column: error.column || 0,
      });
    }
  }

  getNamingConventions(): NamingConvention {
    return {
      variablePattern: /^[a-z][a-zA-Z0-9]*$/,
      functionPattern: /^[a-z][a-zA-Z0-9]*$/,
      classPattern: /^[A-Z][a-zA-Z0-9]*$/,
      constantPattern: /^[A-Z][A-Z0-9_]*$/,
      typePattern: /^[A-Z][a-zA-Z0-9]*$/,
      interfacePattern: /^I?[A-Z][a-zA-Z0-9]*$/,
    };
  }

  analyzeMetadata(node: TSESTree.Node, code: string): Partial<ExportInfo> {
    if (!code) return {};
    // Implementation for behavioral analysis (purity, etc.)
    return {
      isPure: this.isLikelyPure(node),
      hasSideEffects: !this.isLikelyPure(node),
    };
  }

  private extractImports(ast: TSESTree.Program): FileImport[] {
    const imports: FileImport[] = [];

    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        const specifiers: string[] = [];
        let isTypeOnly = false;

        if (node.importKind === 'type') {
          isTypeOnly = true;
        }

        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const imported = spec.imported;
            const name =
              imported.type === 'Identifier' ? imported.name : imported.value;
            specifiers.push(name);
          } else if (spec.type === 'ImportDefaultSpecifier') {
            specifiers.push('default');
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            specifiers.push('*');
          }
        }

        imports.push({
          source: node.source.value as string,
          specifiers,
          isTypeOnly,
          loc: node.loc
            ? {
                start: {
                  line: node.loc.start.line,
                  column: node.loc.start.column,
                },
                end: { line: node.loc.end.line, column: node.loc.end.column },
              }
            : undefined,
        });
      }
    }

    return imports;
  }

  private extractExports(
    ast: TSESTree.Program,
    code: string,
    filePath: string
  ): ExportInfo[] {
    const exports: ExportInfo[] = [];

    for (const node of ast.body) {
      // 1. ExportNamedDeclaration
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          const declaration = node.declaration;

          if (
            (declaration.type === 'FunctionDeclaration' ||
              declaration.type === 'TSDeclareFunction') &&
            declaration.id
          ) {
            exports.push(
              this.createExport(
                declaration.id.name,
                'function',
                node, // Pass the outer ExportNamedDeclaration
                code,
                filePath
              )
            );
          } else if (
            declaration.type === 'ClassDeclaration' &&
            declaration.id
          ) {
            exports.push(
              this.createExport(
                declaration.id.name,
                'class',
                node, // Pass the outer ExportNamedDeclaration
                code,
                filePath
              )
            );
          } else if (declaration.type === 'TSTypeAliasDeclaration') {
            exports.push(
              this.createExport(
                declaration.id.name,
                'type',
                node, // Pass the outer ExportNamedDeclaration
                code,
                filePath
              )
            );
          } else if (declaration.type === 'TSInterfaceDeclaration') {
            exports.push(
              this.createExport(
                declaration.id.name,
                'interface',
                node, // Pass the outer ExportNamedDeclaration
                code,
                filePath
              )
            );
          } else if (declaration.type === 'VariableDeclaration') {
            for (const decl of declaration.declarations) {
              if (decl.id.type === 'Identifier') {
                exports.push(
                  this.createExport(
                    decl.id.name,
                    'const',
                    node,
                    code,
                    filePath,
                    decl.init
                  )
                );
              }
            }
          }
        }
      }
      // 2. ExportDefaultDeclaration
      else if (node.type === 'ExportDefaultDeclaration') {
        exports.push(
          this.createExport('default', 'default', node, code, filePath)
        );
      }
    }

    return exports;
  }

  private createExport(
    name: string,
    type: ExportInfo['type'] | 'interface' | 'type',
    node: TSESTree.Node,
    code: string,
    filePath: string,
    initializer?: TSESTree.Expression | null
  ): ExportInfo {
    const documentation = this.extractDocumentation(node, code);
    let methodCount: number | undefined;
    let propertyCount: number | undefined;
    let parameters: string[] | undefined;
    let isPrimitive = false;
    let isTyped = false;

    // Determine if it's a primitive type if we have an initializer
    if (initializer) {
      if (
        initializer.type === 'Literal' ||
        (initializer.type === 'TemplateLiteral' &&
          initializer.expressions.length === 0)
      ) {
        isPrimitive = true;
      }
    }

    // Resolve internal node if this is an export declaration
    let structNode: TSESTree.Node =
      node.type === 'ExportNamedDeclaration' && node.declaration
        ? node.declaration
        : node.type === 'ExportDefaultDeclaration'
          ? (node.declaration as TSESTree.Node)
          : node;

    if (!structNode) structNode = node;

    // Type detection for TypeScript/JavaScript
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      if (
        structNode.type === 'TSTypeAliasDeclaration' ||
        structNode.type === 'TSInterfaceDeclaration' ||
        structNode.type === 'TSEnumDeclaration'
      ) {
        isTyped = true;
      } else if (
        structNode.type === 'FunctionDeclaration' ||
        structNode.type === 'TSDeclareFunction'
      ) {
        const func = structNode as
          | TSESTree.FunctionDeclaration
          | TSESTree.TSDeclareFunction;
        // Check return type and parameters
        const hasReturnType = !!func.returnType;
        const allParamsTyped =
          func.params.length === 0 ||
          func.params.every((p: any) => !!p.typeAnnotation);
        isTyped = hasReturnType && allParamsTyped;
      } else if (structNode.type === 'VariableDeclaration') {
        const variable = structNode as TSESTree.VariableDeclaration;
        // For variables, check if the identifier has a type annotation
        // or if it's a simple literal (implicit type)
        isTyped = variable.declarations.every(
          (d: any) => !!d.id.typeAnnotation || !!d.init
        );
      } else if (structNode.type === 'ClassDeclaration') {
        isTyped = true; // Classes are structured types
      }
    } else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      // JavaScript exports are never "explicitly typed" in this context
      isTyped = false;
    }

    if (
      structNode.type === 'ClassDeclaration' ||
      structNode.type === 'TSInterfaceDeclaration'
    ) {
      const body =
        structNode.type === 'ClassDeclaration'
          ? structNode.body.body
          : structNode.body.body;

      methodCount = body.filter(
        (m) => m.type === 'MethodDefinition' || m.type === 'TSMethodSignature'
      ).length;
      propertyCount = body.filter(
        (m) =>
          m.type === 'PropertyDefinition' || m.type === 'TSPropertySignature'
      ).length;

      // Extract constructor parameters for classes
      if (structNode.type === 'ClassDeclaration') {
        const constructor = body.find(
          (m) => m.type === 'MethodDefinition' && m.kind === 'constructor'
        ) as TSESTree.MethodDefinition | undefined;
        if (constructor && constructor.value && constructor.value.params) {
          parameters = constructor.value.params
            .map((p) => {
              if (p.type === 'Identifier') return p.name;
              if (
                p.type === 'TSParameterProperty' &&
                p.parameter.type === 'Identifier'
              ) {
                return p.parameter.name;
              }
              return undefined;
            })
            .filter((p): p is string => !!p);
        }
      }
    }

    // Extract parameters for functions
    if (
      !parameters &&
      (structNode.type === 'FunctionDeclaration' ||
        structNode.type === 'TSDeclareFunction' ||
        structNode.type === 'MethodDefinition')
    ) {
      const funcNode =
        structNode.type === 'MethodDefinition' ? structNode.value : structNode;
      if (funcNode && funcNode.params) {
        parameters = funcNode.params
          .map((p) => {
            if (p.type === 'Identifier') return p.name;
            return undefined;
          })
          .filter((p): p is string => !!p);
      }
    }

    return {
      name,
      type: type as ExportInfo['type'],
      isPrimitive,
      loc: node.loc
        ? {
            start: { line: node.loc.start.line, column: node.loc.start.column },
            end: { line: node.loc.end.line, column: node.loc.end.column },
          }
        : undefined,
      documentation,
      methodCount,
      propertyCount,
      parameters,
      isPure: this.isLikelyPure(node),
      hasSideEffects: !this.isLikelyPure(node),
      isTyped,
    };
  }

  private extractDocumentation(node: TSESTree.Node, code: string): any {
    // Look for JSDoc style comments in the code before the node
    if (node.range) {
      const start = node.range[0];
      // Search further back to find the comment even if there are multiple lines of whitespace
      const precedingCode = code.substring(0, start);
      const jsdocMatch = precedingCode.match(/\/\*\*([\s\S]*?)\*\/\s*$/);

      if (jsdocMatch) {
        return {
          content: jsdocMatch[1].trim(),
          type: 'jsdoc',
        };
      }
    }
    return undefined;
  }

  private isLikelyPure(node: TSESTree.Node): boolean {
    const sn: TSESTree.Node =
      node.type === 'ExportNamedDeclaration' && node.declaration
        ? node.declaration
        : node.type === 'ExportDefaultDeclaration'
          ? (node.declaration as TSESTree.Node)
          : node;

    if (!sn) return false;

    // Constants are likely pure
    if (sn.type === 'VariableDeclaration' && sn.kind === 'const') return true;

    // For functions, check if the body has obvious side effects
    if (sn.type === 'FunctionDeclaration' || sn.type === 'MethodDefinition') {
      const body =
        sn.type === 'MethodDefinition'
          ? (sn.value as TSESTree.FunctionExpression).body
          : (sn as TSESTree.FunctionDeclaration).body;

      if (body && body.type === 'BlockStatement') {
        const bodyContent = JSON.stringify(body);
        // Look for common side-effect indicators in the stringified AST
        if (
          bodyContent.includes('"name":"console"') ||
          bodyContent.includes('"name":"process"') ||
          bodyContent.includes('"type":"AssignmentExpression"')
        ) {
          return false;
        }
        return true;
      }
      // If it's a signature (no body), it's likely part of an overloaded function.
      return true;
    }

    return false;
  }
}
