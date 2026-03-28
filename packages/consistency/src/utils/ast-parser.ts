import { parse, TSESTree } from '@typescript-eslint/typescript-estree';
import { readFileSync } from 'fs';

/**
 * Parse a file into an AST
 * Only supports TypeScript/JavaScript files (.ts, .tsx, .js, .jsx)
 */
export function parseFile(
  filePath: string,
  content?: string
): TSESTree.Program | null {
  try {
    const code = content ?? readFileSync(filePath, 'utf-8');
    const isTypeScript = filePath.match(/\.tsx?$/);

    return parse(code, {
      jsx: filePath.match(/\.[jt]sx$/i) !== null,
      loc: true,
      range: true,
      comment: false,
      tokens: false,
      // Relaxed parsing for JavaScript files
      sourceType: 'module',
      ecmaVersion: 'latest',
      // Only use TypeScript parser features for .ts/.tsx files
      filePath: isTypeScript ? filePath : undefined,
    });
  } catch (error) {
    void error;
    // Silently skip files that fail to parse (likely non-JS/TS or syntax errors)
    // Non-JS/TS files should be filtered before reaching this point
    return null;
  }
}

/**
 * Traverse AST nodes with a visitor pattern
 */
export function traverseAST(
  node: TSESTree.Node,
  visitor: {
    enter?: (node: TSESTree.Node, parent: TSESTree.Node | null) => void;
    leave?: (node: TSESTree.Node, parent: TSESTree.Node | null) => void;
  },
  parent: TSESTree.Node | null = null
): void {
  if (!node) return;

  visitor.enter?.(node, parent);

  // Visit children
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === 'object' && 'type' in child) {
          traverseAST(child as TSESTree.Node, visitor, node);
        }
      }
    } else if (value && typeof value === 'object' && 'type' in value) {
      traverseAST(value as TSESTree.Node, visitor, node);
    }
  }

  visitor.leave?.(node, parent);
}

/**
 * Check if a node is within a specific type of ancestor
 */
export function hasAncestor(
  node: TSESTree.Node,
  ancestorTypes: string[],
  ancestors: TSESTree.Node[]
): boolean {
  return ancestors.some((ancestor) => ancestorTypes.includes(ancestor.type));
}

/**
 * Get the name of an identifier or pattern
 */
export function getIdentifierName(node: TSESTree.Node): string | null {
  if (node.type === 'Identifier') {
    return node.name;
  }
  return null;
}

/**
 * Check if a node is a loop
 */
export function isLoopStatement(node: TSESTree.Node): boolean {
  return [
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
    'WhileStatement',
    'DoWhileStatement',
  ].includes(node.type);
}

/**
 * Check if a node is an arrow function or callback
 */
export function isCallback(node: TSESTree.Node): boolean {
  if (node.type === 'ArrowFunctionExpression') {
    return true;
  }
  if (node.type === 'FunctionExpression') {
    return true;
  }
  return false;
}

/**
 * Extract function/method name from various declaration types
 */
export function getFunctionName(node: TSESTree.Node): string | null {
  switch (node.type) {
    case 'FunctionDeclaration':
      return node.id?.name ?? null;
    case 'FunctionExpression':
      return node.id?.name ?? null;
    case 'ArrowFunctionExpression':
      return null; // Arrow functions don't have names directly
    case 'MethodDefinition':
      if (node.key.type === 'Identifier') {
        return node.key.name;
      }
      return null;
    default:
      return null;
  }
}

/**
 * Check if a variable declaration is in a destructuring pattern
 */
export function isInDestructuring(node: TSESTree.Node): boolean {
  if (!node) return false;

  return node.type === 'ObjectPattern' || node.type === 'ArrayPattern';
}

/**
 * Get the line number from a node
 */
export function getLineNumber(node: TSESTree.Node): number {
  return node.loc?.start.line ?? 0;
}

/**
 * Check if a node represents a coverage metric context
 */
export function isCoverageContext(
  node: TSESTree.Node,
  ancestors: TSESTree.Node[]
): boolean {
  // Check if any ancestor or the node itself references coverage-related properties
  const coveragePatterns =
    /coverage|summary|metrics|pct|percent|statements|branches|functions|lines/i;

  // Check variable name
  if (node.type === 'Identifier' && coveragePatterns.test(node.name)) {
    return true;
  }

  // Check if it's a property of something coverage-related
  for (const ancestor of ancestors.slice(-3)) {
    // Check last 3 ancestors
    if (ancestor.type === 'MemberExpression') {
      const memberExpr = ancestor as TSESTree.MemberExpression;
      if (
        memberExpr.object.type === 'Identifier' &&
        coveragePatterns.test(memberExpr.object.name)
      ) {
        return true;
      }
    }
    if (
      ancestor.type === 'ObjectPattern' ||
      ancestor.type === 'ObjectExpression'
    ) {
      // Check if parent variable has coverage-related name
      const parent = ancestors[ancestors.indexOf(ancestor) - 1];
      if (parent?.type === 'VariableDeclarator') {
        const varDecl = parent as TSESTree.VariableDeclarator;
        if (
          varDecl.id.type === 'Identifier' &&
          coveragePatterns.test(varDecl.id.name)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}
