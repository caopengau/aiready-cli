import { Severity, IssueType, SignalContext, SignalResult } from './types';
import {
  isAmbiguousName,
  isMagicNumber,
  isMagicString,
  isRedundantTypeConstant,
} from '../helpers';
import {
  CATEGORY_MAGIC_LITERAL,
  CATEGORY_REDUNDANT_TYPE_CONSTANT,
  CATEGORY_BOOLEAN_TRAP,
  CATEGORY_AMBIGUOUS_NAME,
  CATEGORY_DEEP_CALLBACK,
  CALLBACK_DEPTH_THRESHOLD,
} from './constants';
import type { TSESTree } from '@typescript-eslint/types';
import type * as Parser from 'web-tree-sitter';

/**
 * Detect if a file is likely a Lambda handler or serverless function.
 */
function isLambdaHandlerFile(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  return (
    normalizedPath.includes('handler') ||
    normalizedPath.includes('lambda') ||
    normalizedPath.includes('/handlers/') ||
    normalizedPath.includes('/functions/') ||
    normalizedPath.endsWith('.handler.ts') ||
    normalizedPath.endsWith('.handler.js')
  );
}

/**
 * Check if a boolean value is a common Lambda/Serverless parameter.
 */
function isLambdaBooleanParam(
  node: TSESTree.Node,
  parent?: TSESTree.Node
): boolean {
  // Check if the boolean is part of a Lambda event/context
  if (!parent) return false;

  // Common Lambda boolean parameters
  const lambdaBooleans = new Set([
    'isBase64Encoded',
    'isBase64',
    'multiValueHeaders',
    'queryStringParameters',
    'pathParameters',
    'stageVariables',
  ]);

  // Check if parent is a Property and key is a Lambda boolean
  if (parent.type === 'Property' && parent.key) {
    const key = parent.key as TSESTree.Identifier | TSESTree.Literal;
    const keyName =
      (key as TSESTree.Identifier).name || (key as TSESTree.Literal).value;
    if (typeof keyName === 'string' && lambdaBooleans.has(keyName)) {
      return true;
    }
  }

  return false;
}

/**
 * Traverses the AST and detects structural signals like magic literals and boolean traps.
 */
export function detectStructuralSignals(
  ctx: SignalContext,
  ast: TSESTree.Node | { rootNode: Parser.Node }
): SignalResult {
  const issues: any[] = [];
  const signals = {
    magicLiterals: 0,
    booleanTraps: 0,
    ambiguousNames: 0,
    deepCallbacks: 0,
  };

  const { filePath, options, domainVocabulary } = ctx;

  let callbackDepth = 0;
  let maxCallbackDepth = 0;

  const isConfigFile =
    filePath.endsWith('.config.ts') ||
    filePath.endsWith('.config.js') ||
    filePath.endsWith('.config.mts') ||
    filePath.endsWith('.config.mjs') ||
    filePath.includes('sst.config.ts') ||
    filePath.endsWith('playwright.config.ts');

  const visitNode = (
    node: TSESTree.Node | Parser.Node,
    parent?: TSESTree.Node | Parser.Node,
    keyInParent?: string
  ) => {
    if (!node) return;

    const isTreeSitter = 'namedChildren' in node;

    // --- Magic Literals ---
    if (options.checkMagicLiterals !== false) {
      // Tree-sitter (Python, Java, etc.)
      if (isTreeSitter) {
        const tsNode = node as Parser.Node;
        if (tsNode.type === 'number') {
          const val = parseFloat(tsNode.text);
          if (!isNaN(val) && isMagicNumber(val)) {
            signals.magicLiterals++;
            issues.push({
              type: IssueType.MagicLiteral,
              category: CATEGORY_MAGIC_LITERAL,
              severity: Severity.Minor,
              message: `Magic number ${tsNode.text} — AI will invent wrong semantics. Extract to a named constant.`,
              location: {
                file: filePath,
                line: tsNode.startPosition.row + 1,
                column: tsNode.startPosition.column,
              },
              suggestion: `const MEANINGFUL_NAME = ${tsNode.text};`,
            });
          }
        } else if (
          tsNode.type === 'string' ||
          tsNode.type === 'string_literal'
        ) {
          const val = tsNode.text.replace(/['"]/g, '');
          // Heuristic: ignore if it's likely a key in a map/dictionary (Tree-sitter)
          const isKey =
            tsNode.parent?.type?.includes('pair') ||
            tsNode.parent?.type === 'assignment_expression';

          // Skip if it's an import/require/use statement (Tree-sitter)
          const isImport =
            tsNode.parent?.type?.toLowerCase().includes('import') ||
            tsNode.parent?.type?.toLowerCase().includes('require') ||
            tsNode.parent?.type?.toLowerCase().includes('use');

          const parentName =
            tsNode.parent?.childForFieldName('name')?.text || '';

          const isNamedConstant = /^[A-Z0-9_]{2,}$/.test(parentName);

          if (
            !isKey &&
            !isImport &&
            !isNamedConstant &&
            isRedundantTypeConstant(parentName, val)
          ) {
            issues.push({
              type: IssueType.AiSignalClarity,
              category: CATEGORY_REDUNDANT_TYPE_CONSTANT,
              severity: Severity.Minor,
              message: `Redundant type constant — in modern AI-native code, use literals or centralized union types for transparency.`,
              location: {
                file: filePath,
                line: tsNode.startPosition.row + 1,
              },
              suggestion: `Use '${val}' directly in your schema.`,
            });
          } else if (
            !isKey &&
            !isImport &&
            !isNamedConstant &&
            isMagicString(val)
          ) {
            // Check if this is a domain-specific term
            const isDomain =
              domainVocabulary && domainVocabulary.has(val.toLowerCase());

            if (!isDomain) {
              signals.magicLiterals++;
              issues.push({
                type: IssueType.MagicLiteral,
                category: CATEGORY_MAGIC_LITERAL,
                severity: Severity.Info,
                message: `Magic string "${val}" — intent is ambiguous to AI. Consider a named constant.`,
                location: {
                  file: filePath,
                  line: tsNode.startPosition.row + 1,
                },
              });
            }
          }
        }
      }
      // ESTree (TypeScript, JavaScript)
      else {
        const esNode = node as TSESTree.Node;
        const esParent = parent as TSESTree.Node | undefined;

        if (esNode.type === 'Literal') {
          let isNamedConstant = false;

          // Check if this literal is part of a constant declaration (possibly nested in Array/Set/Object)
          let depth = 0;
          let p: TSESTree.Node | undefined = esParent;
          while (p && depth < 10) {
            if (
              p.type === 'VariableDeclarator' &&
              p.id.type === 'Identifier' &&
              /^[A-Z0-9_]{2,}$/.test(p.id.name)
            ) {
              isNamedConstant = true;
              break;
            }
            if (
              [
                'ArrayExpression',
                'NewExpression',
                'Property',
                'ObjectExpression',
                'TSAsExpression',
                'TSTypeAssertion',
              ].includes(p.type)
            ) {
              p = (p as { parent?: TSESTree.Node }).parent;
              depth++;
            } else {
              break;
            }
          }

          // Fallback for manual recursion where .parent might not be set on nodes
          if (!isNamedConstant && esParent) {
            isNamedConstant =
              esParent.type === 'VariableDeclarator' &&
              esParent.id.type === 'Identifier' &&
              /^[A-Z0-9_]{2,}$/.test(esParent.id.name);
          }

          const isObjectKey =
            esParent?.type === 'Property' && keyInParent === 'key';

          const isJSXAttribute = esParent?.type === 'JSXAttribute';

          // Skip magic literal check for import/export sources (Category 1)
          const isImportSource =
            (esParent?.type === 'ImportDeclaration' ||
              esParent?.type === 'ExportNamedDeclaration' ||
              esParent?.type === 'ExportAllDeclaration') &&
            keyInParent === 'source';

          // Skip magic literal check for common require arg (Category 1)
          const isRequireArg =
            esParent?.type === 'CallExpression' &&
            esParent.callee?.type === 'Identifier' &&
            esParent.callee?.name === 'require';

          // Check if this is a value in a JSX style object (Issue: Context-Blind CSS analysis)
          let isStyleValue = false;
          if (esParent?.type === 'Property' && keyInParent === 'value') {
            let p: TSESTree.Node | undefined = (
              esParent as { parent?: TSESTree.Node }
            ).parent; // ObjectExpression
            while (p && p.type === 'ObjectExpression') {
              const grandParent: TSESTree.Node | undefined = (
                p as { parent?: TSESTree.Node }
              ).parent;
              if (grandParent?.type === 'JSXExpressionContainer') {
                const attr = grandParent.parent;
                if (
                  attr?.type === 'JSXAttribute' &&
                  attr.name?.type === 'JSXIdentifier' &&
                  attr.name.name === 'style'
                ) {
                  isStyleValue = true;
                  break;
                }
              }
              // Could be nested: style={{ base: { display: 'flex' } }}
              p =
                grandParent?.type === 'Property'
                  ? (grandParent as { parent?: TSESTree.Node }).parent
                  : undefined;
            }
          }

          const esLiteral = esNode as TSESTree.Literal;
          const redundantType =
            typeof esLiteral.value === 'string'
              ? isRedundantTypeConstant(
                  esParent?.type === 'VariableDeclarator' &&
                    esParent.id.type === 'Identifier'
                    ? esParent.id.name
                    : '',
                  esLiteral.value
                )
              : false;

          if (redundantType) {
            issues.push({
              type: IssueType.AiSignalClarity,
              category: CATEGORY_REDUNDANT_TYPE_CONSTANT,
              severity: Severity.Minor,
              message: `Redundant type constant "${
                (esParent as { id?: { name?: string } }).id?.name
              }" = '${
                esLiteral.value
              }' — in modern AI-native code, use literals or centralized union types for transparency.`,
              location: {
                file: filePath,
                line: esLiteral.loc?.start.line || 1,
              },
              suggestion: `Use '${esLiteral.value}' directly in your schema.`,
            });
          } else if (
            isNamedConstant ||
            isObjectKey ||
            isJSXAttribute ||
            isImportSource ||
            isRequireArg ||
            isStyleValue ||
            (isConfigFile && typeof esLiteral.value === 'string')
          ) {
            // Skip magic literal check for these contextually safe literals
          } else if (
            typeof esLiteral.value === 'number' &&
            isMagicNumber(esLiteral.value)
          ) {
            signals.magicLiterals++;
            issues.push({
              type: IssueType.MagicLiteral,
              category: CATEGORY_MAGIC_LITERAL,
              severity: Severity.Minor,
              message: `Magic number ${esLiteral.value} — AI will invent wrong semantics. Extract to a named constant.`,
              location: {
                file: filePath,
                line: esLiteral.loc?.start.line || 1,
                column: esLiteral.loc?.start.column,
              },
              suggestion: `const MEANINGFUL_NAME = ${esLiteral.value};`,
            });
          } else if (
            typeof esLiteral.value === 'string' &&
            isMagicString(esLiteral.value)
          ) {
            // Check if this is a domain-specific term
            const isDomain =
              domainVocabulary &&
              domainVocabulary.has(esLiteral.value.toLowerCase());

            if (!isDomain) {
              signals.magicLiterals++;
              issues.push({
                type: IssueType.MagicLiteral,
                category: CATEGORY_MAGIC_LITERAL,
                severity: Severity.Info,
                message: `Magic string "${esLiteral.value}" — intent is ambiguous to AI. Consider a named constant.`,
                location: {
                  file: filePath,
                  line: esLiteral.loc?.start.line || 1,
                },
              });
            }
          }
        }
      }
    }

    // --- Boolean Traps ---
    if (options.checkBooleanTraps !== false) {
      const isLambdaContext = isLambdaHandlerFile(filePath);

      // Tree-sitter
      if (isTreeSitter) {
        const tsNode = node as Parser.Node;
        if (tsNode.type === 'argument_list') {
          const hasBool = tsNode.namedChildren?.some(
            (c: Parser.Node) =>
              c.type === 'true' ||
              c.type === 'false' ||
              (c.type === 'boolean' &&
                (c.text === 'true' || c.text === 'false'))
          );
          if (hasBool) {
            // Skip if this is a Lambda context
            if (!isLambdaContext) {
              signals.booleanTraps++;
              issues.push({
                type: IssueType.BooleanTrap,
                category: CATEGORY_BOOLEAN_TRAP,
                severity: Severity.Major,
                message: `Boolean trap: positional boolean argument at call site. AI inverts intent ~30% of the time.`,
                location: {
                  file: filePath,
                  line: (tsNode.startPosition?.row || 0) + 1,
                },
                suggestion:
                  'Replace boolean arg with a named options object or separate functions.',
              });
            }
          }
        }
      }
      // ESTree
      else {
        const esNode = node as TSESTree.Node;
        const esParent = parent as TSESTree.Node | undefined;
        if (esNode.type === 'CallExpression') {
          const hasBool = esNode.arguments.some(
            (arg: TSESTree.Node) =>
              arg.type === 'Literal' && typeof arg.value === 'boolean'
          );
          if (hasBool) {
            // Check if this is a Lambda-specific boolean
            const isLambdaBool = esNode.arguments.some((arg: TSESTree.Node) =>
              isLambdaBooleanParam(arg, esParent)
            );
            const isUseStateCall =
              esNode.callee?.type === 'Identifier' &&
              esNode.callee?.name === 'useState';

            if (!isLambdaContext && !isLambdaBool && !isUseStateCall) {
              signals.booleanTraps++;
              issues.push({
                type: IssueType.BooleanTrap,
                category: CATEGORY_BOOLEAN_TRAP,
                severity: Severity.Major,
                message: `Boolean trap: positional boolean argument at call site. AI inverts intent ~30% of the time.`,
                location: {
                  file: filePath,
                  line: esNode.loc?.start.line || 1,
                },
                suggestion:
                  'Replace boolean arg with a named options object or separate functions.',
              });
            }
          }
        }
      }
    }

    // --- Ambiguous Names ---
    if (options.checkAmbiguousNames !== false) {
      // Tree-sitter
      if (isTreeSitter) {
        const tsNode = node as Parser.Node;
        if (tsNode.type === 'variable_declarator') {
          const nameNode = tsNode.childForFieldName('name');
          if (nameNode && isAmbiguousName(nameNode.text)) {
            signals.ambiguousNames++;
            issues.push({
              type: IssueType.AmbiguousApi,
              category: CATEGORY_AMBIGUOUS_NAME,
              severity: Severity.Info,
              message: `Ambiguous variable name "${nameNode.text}" — AI intent is unclear.`,
              location: {
                file: filePath,
                line: tsNode.startPosition.row + 1,
              },
            });
          }
        }
      }
      // ESTree
      else {
        const esNode = node as TSESTree.Node;
        if (
          esNode.type === 'VariableDeclarator' &&
          esNode.id.type === 'Identifier'
        ) {
          if (isAmbiguousName(esNode.id.name)) {
            // Relax for 'data' when initialized from obvious sources (Issue: Universal pattern context)
            const isDataFromJson =
              esNode.id.name === 'data' &&
              esNode.init &&
              ctx.code
                .slice(
                  (esNode.init as { range?: [number, number] }).range?.[0] || 0,
                  (esNode.init as { range?: [number, number] }).range?.[1] || 0
                )
                .includes('.json()');

            if (!isDataFromJson) {
              signals.ambiguousNames++;
              issues.push({
                type: IssueType.AmbiguousApi,
                category: CATEGORY_AMBIGUOUS_NAME,
                severity: Severity.Info,
                message: `Ambiguous variable name "${esNode.id.name}" — AI intent is unclear.`,
                location: {
                  file: filePath,
                  line: esNode.loc?.start.line || 1,
                },
              });
            }
          }
        }
      }
    }

    // --- Callback Depth ---
    const nodeType = (
      (isTreeSitter
        ? (node as Parser.Node).type
        : (node as TSESTree.Node).type) || ''
    ).toLowerCase();
    const isFunction =
      nodeType.includes('function') ||
      nodeType.includes('arrow') ||
      nodeType.includes('lambda') ||
      nodeType === 'method_declaration';

    if (isFunction) {
      callbackDepth++;
      maxCallbackDepth = Math.max(maxCallbackDepth, callbackDepth);
    }

    // Recurse Tree-sitter
    if ('namedChildren' in node) {
      for (const child of node.namedChildren) {
        visitNode(child, node);
      }
    }
    // Recurse ESTree
    else {
      const estreeNode = node as TSESTree.Node & { [key: string]: any };
      for (const key in estreeNode) {
        if (
          key === 'parent' ||
          key === 'loc' ||
          key === 'range' ||
          key === 'tokens'
        )
          continue;
        const child = estreeNode[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach((c) => {
              if (c && typeof c.type === 'string') {
                c.parent = estreeNode;
                visitNode(c, estreeNode, key);
              }
            });
          } else if (typeof child.type === 'string') {
            child.parent = estreeNode;
            visitNode(child, estreeNode, key);
          }
        }
      }
    }

    if (isFunction) {
      callbackDepth--;
    }
  };

  // Start visiting
  if ('rootNode' in ast) {
    visitNode(ast.rootNode); // Tree-sitter
  } else {
    visitNode(ast); // ESTree
  }

  if (
    options.checkDeepCallbacks !== false &&
    maxCallbackDepth >= CALLBACK_DEPTH_THRESHOLD
  ) {
    signals.deepCallbacks = maxCallbackDepth - (CALLBACK_DEPTH_THRESHOLD - 1);
    issues.push({
      type: IssueType.AiSignalClarity,
      category: CATEGORY_DEEP_CALLBACK,
      severity: Severity.Major,
      message: `Deeply nested logic (depth ${maxCallbackDepth}) — AI loses control flow context beyond ${CALLBACK_DEPTH_THRESHOLD} levels.`,
      location: {
        file: filePath,
        line: 1,
      },
      suggestion:
        'Extract nested logic into named functions or flatten the structure.',
    });
  }

  return { issues, signals };
}
