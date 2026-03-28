import { parse, TSESTree } from '@typescript-eslint/typescript-estree';
import { Severity, IssueType } from '@aiready/core';
import type {
  ContractEnforcementIssue,
  DetectionResult,
  DefensivePattern,
  PatternCounts,
} from './types';
import { ZERO_COUNTS } from './types';

function makeIssue(
  pattern: DefensivePattern,
  severity: Severity,
  message: string,
  filePath: string,
  line: number,
  column: number,
  context: string
): ContractEnforcementIssue {
  return {
    type: IssueType.ContractGap,
    severity,
    pattern,
    message,
    location: { file: filePath, line, column },
    context,
    suggestion: getSuggestion(pattern),
  };
}

function getSuggestion(pattern: DefensivePattern): string {
  switch (pattern) {
    case 'as-any':
      return 'Define a proper type or use type narrowing instead of `as any`.';
    case 'as-unknown':
      return 'Use a single validated type assertion or schema validation instead of `as unknown as`.';
    case 'deep-optional-chain':
      return 'Enforce a non-nullable type at the source to eliminate deep optional chaining.';
    case 'nullish-literal-default':
      return 'Define defaults in a typed config object rather than inline literal fallbacks.';
    case 'swallowed-error':
      return 'Log or propagate errors — silent catch blocks hide failures.';
    case 'env-fallback':
      return 'Use a validated env schema (e.g., Zod) to enforce required variables at startup.';
    case 'unnecessary-guard':
      return 'Make the parameter non-nullable in the type signature to eliminate the guard.';
    case 'any-parameter':
      return 'Define a proper type for this parameter instead of `any`.';
    case 'any-return':
      return 'Define a proper return type instead of `any`.';
  }
}

function getLineContent(code: string, line: number): string {
  const lines = code.split('\n');
  return (lines[line - 1] || '').trim().slice(0, 120);
}

function countOptionalChainDepth(node: TSESTree.Node): number {
  let depth = 0;
  let current: TSESTree.Node | undefined = node;
  while (current) {
    if (current.type === 'MemberExpression' && current.optional) {
      depth++;
      current = current.object;
    } else if (current.type === 'ChainExpression') {
      current = current.expression;
    } else if (current.type === 'CallExpression' && current.optional) {
      depth++;
      current = current.callee;
    } else {
      break;
    }
  }
  return depth;
}

function isLiteral(node: TSESTree.Node): boolean {
  if (node.type === 'Literal') return true;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    return true;
  if (
    node.type === 'UnaryExpression' &&
    (node.operator === '-' || node.operator === '+')
  ) {
    return isLiteral(node.argument);
  }
  return false;
}

function isProcessEnvAccess(node: TSESTree.Node | undefined): boolean {
  return (
    node?.type === 'MemberExpression' &&
    node.object?.type === 'MemberExpression' &&
    node.object.object?.type === 'Identifier' &&
    node.object.object.name === 'process' &&
    node.object.property?.type === 'Identifier' &&
    node.object.property.name === 'env'
  );
}

function isSstResourceAccess(node: TSESTree.Node): boolean {
  let current: TSESTree.Node = node;
  // Handle ChainExpression for optional chaining like Resource.MySecret?.value
  if (current.type === 'ChainExpression') {
    current = current.expression;
  }

  // Recursively check for 'Resource' identifier at the base of the member chain
  while (current && current.type === 'MemberExpression') {
    if (
      current.object?.type === 'Identifier' &&
      current.object.name === 'Resource'
    ) {
      return true;
    }
    current = current.object;
  }

  // Also check if the node itself is 'Resource' (rare but possible in some contexts)
  if (current?.type === 'Identifier' && current.name === 'Resource') {
    return true;
  }

  return false;
}

function isSwallowedCatch(
  body: TSESTree.Statement[],
  filePath: string
): boolean {
  if (body.length === 0) return true;

  // UI components often have intentional silent catches for telemetry/analytics
  const isUiComponent = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');

  if (body.length === 1) {
    const stmt = body[0];
    if (
      stmt.type === 'ExpressionStatement' &&
      stmt.expression?.type === 'CallExpression'
    ) {
      const callee = stmt.expression.callee;
      // console.log/warn/error is still considered "swallowed" but might be acceptable
      if (
        callee?.type === 'MemberExpression' &&
        callee.object?.type === 'Identifier' &&
        callee.object.name === 'console'
      )
        return true;

      // If it's a UI component and looks like telemetry, it's a false positive
      if (isUiComponent) {
        let calleeName = '';
        if (callee?.type === 'Identifier') calleeName = callee.name;
        else if (
          callee?.type === 'MemberExpression' &&
          callee.property.type === 'Identifier'
        )
          calleeName = callee.property.name;

        if (/telemetry|analytics|track|logEvent/i.test(calleeName)) {
          return false; // Not "swallowed" in a bad way
        }
      }
    }
    if (stmt.type === 'ThrowStatement') return false;
  }

  return false;
}

export function detectDefensivePatterns(
  filePath: string,
  code: string,
  minChainDepth: number = 3
): DetectionResult {
  const issues: ContractEnforcementIssue[] = [];
  const counts: PatternCounts = { ...ZERO_COUNTS };
  const totalLines = code.split('\n').length;

  let ast: TSESTree.Program;
  try {
    ast = parse(code, {
      filePath,
      loc: true,
      range: true,
      jsx: filePath.endsWith('x'),
    });
  } catch {
    return { issues, counts, totalLines };
  }

  const nodesAtFunctionStart = new WeakSet<TSESTree.Node>();

  function markFunctionParamNodes(node: TSESTree.Node) {
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      const body = node.body?.type === 'BlockStatement' ? node.body.body : null;
      if (body && body.length > 0) {
        nodesAtFunctionStart.add(body[0]);
      }
    }
  }

  function visit(
    node: TSESTree.Node | undefined,
    _parent?: TSESTree.Node,
    _keyInParent?: string
  ) {
    if (!node || typeof node !== 'object') return;

    markFunctionParamNodes(node);

    // Pattern: as any
    if (
      node.type === 'TSAsExpression' &&
      node.typeAnnotation?.type === 'TSAnyKeyword'
    ) {
      // Ignore if it's acting on an SST resource or process.env, common "necessary escape hatches"
      if (
        !isSstResourceAccess(node.expression) &&
        !isProcessEnvAccess(node.expression)
      ) {
        counts['as-any']++;
        issues.push(
          makeIssue(
            'as-any',
            Severity.Major,
            '`as any` type assertion bypasses type safety',
            filePath,
            node.loc.start.line,
            node.loc.start.column,
            getLineContent(code, node.loc.start.line)
          )
        );
      }
    }

    // Pattern: as unknown
    if (
      node.type === 'TSAsExpression' &&
      node.typeAnnotation?.type === 'TSUnknownKeyword'
    ) {
      // Ignore if it's acting on an SST resource or process.env
      if (
        !isSstResourceAccess(node.expression) &&
        !isProcessEnvAccess(node.expression)
      ) {
        counts['as-unknown']++;
        issues.push(
          makeIssue(
            'as-unknown',
            Severity.Major,
            '`as unknown` double-cast bypasses type safety',
            filePath,
            node.loc.start.line,
            node.loc.start.column,
            getLineContent(code, node.loc.start.line)
          )
        );
      }
    }

    // Pattern: deep optional chaining
    if (node.type === 'ChainExpression') {
      const depth = countOptionalChainDepth(node);
      if (depth >= minChainDepth) {
        counts['deep-optional-chain']++;
        issues.push(
          makeIssue(
            'deep-optional-chain',
            Severity.Minor,
            `Optional chain depth of ${depth} indicates missing structural guarantees`,
            filePath,
            node.loc.start.line,
            node.loc.start.column,
            getLineContent(code, node.loc.start.line)
          )
        );
      }
    }

    // Pattern: nullish coalescing with literal default
    if (
      node.type === 'LogicalExpression' &&
      node.operator === '??' &&
      isLiteral(node.right)
    ) {
      // Ignore if it's an SST Resource or process.env - the standard way to handle fallbacks
      if (!isSstResourceAccess(node.left) && !isProcessEnvAccess(node.left)) {
        counts['nullish-literal-default']++;
        issues.push(
          makeIssue(
            'nullish-literal-default',
            Severity.Minor,
            'Nullish coalescing with literal default suggests missing upstream type guarantee',
            filePath,
            node.loc.start.line,
            node.loc.start.column,
            getLineContent(code, node.loc.start.line)
          )
        );
      }
    }

    // Pattern: swallowed error
    if (node.type === 'TryStatement' && node.handler) {
      const catchBody = node.handler.body?.body;
      if (catchBody && isSwallowedCatch(catchBody, filePath)) {
        counts['swallowed-error']++;
        issues.push(
          makeIssue(
            'swallowed-error',
            Severity.Major,
            'Error is swallowed in catch block — failures will be silent',
            filePath,
            node.handler.loc.start.line,
            node.handler.loc.start.column,
            getLineContent(code, node.handler.loc.start.line)
          )
        );
      }
    }

    // Pattern: process.env.X || default
    if (
      node.type === 'LogicalExpression' &&
      node.operator === '||' &&
      isProcessEnvAccess(node.left)
    ) {
      counts['env-fallback']++;
      issues.push(
        makeIssue(
          'env-fallback',
          Severity.Minor,
          'Environment variable with fallback — use a validated env schema instead',
          filePath,
          node.loc.start.line,
          node.loc.start.column,
          getLineContent(code, node.loc.start.line)
        )
      );
    }

    // Pattern: if (!x) return guard at function entry
    if (
      node.type === 'IfStatement' &&
      node.test?.type === 'UnaryExpression' &&
      node.test.operator === '!'
    ) {
      const consequent = node.consequent;
      let isReturn = false;
      if (consequent.type === 'ReturnStatement') {
        isReturn = true;
      } else if (
        consequent.type === 'BlockStatement' &&
        consequent.body?.length === 1 &&
        consequent.body[0].type === 'ReturnStatement'
      ) {
        isReturn = true;
      }
      if (isReturn && nodesAtFunctionStart.has(node)) {
        counts['unnecessary-guard']++;
        issues.push(
          makeIssue(
            'unnecessary-guard',
            Severity.Info,
            'Guard clause could be eliminated with non-nullable type at source',
            filePath,
            node.loc.start.line,
            node.loc.start.column,
            getLineContent(code, node.loc.start.line)
          )
        );
      }
    }

    // Pattern: any parameter type
    if (
      (node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression') &&
      node.params
    ) {
      for (const param of node.params) {
        let typeAnno: TSESTree.TypeNode | undefined;

        // Handle Identifier, AssignmentPattern, RestElement, etc.
        if ('typeAnnotation' in param && param.typeAnnotation) {
          typeAnno = (param.typeAnnotation as TSESTree.TSTypeAnnotation)
            .typeAnnotation;
        }

        if (typeAnno?.type === 'TSAnyKeyword') {
          counts['any-parameter']++;
          issues.push(
            makeIssue(
              'any-parameter',
              Severity.Major,
              'Parameter typed as `any` bypasses type safety',
              filePath,
              param.loc.start.line,
              param.loc.start.column,
              getLineContent(code, param.loc.start.line)
            )
          );
        }
      }

      // Pattern: any return type
      let returnAnno: TSESTree.TypeNode | undefined;
      if ('returnType' in node && node.returnType) {
        returnAnno = (node.returnType as TSESTree.TSTypeAnnotation)
          .typeAnnotation;
      }

      if (returnAnno?.type === 'TSAnyKeyword') {
        const fnNode = node as TSESTree.FunctionDeclaration;
        if (fnNode.returnType?.loc) {
          counts['any-return']++;
          issues.push(
            makeIssue(
              'any-return',
              Severity.Major,
              'Return type is `any` — callers cannot rely on the result shape',
              filePath,
              fnNode.returnType.loc.start.line,
              fnNode.returnType.loc.start.column,
              getLineContent(code, fnNode.returnType.loc.start.line)
            )
          );
        }
      }
    }

    // Recurse
    for (const key in node) {
      if (key === 'loc' || key === 'range' || key === 'parent') continue;
      const child = (node as Record<string, any>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item.type === 'string') {
            visit(item as TSESTree.Node, node, key);
          }
        }
      } else if (
        child &&
        typeof child === 'object' &&
        typeof child.type === 'string'
      ) {
        visit(child as TSESTree.Node, node, key);
      }
    }
  }

  visit(ast);
  return { issues, counts, totalLines };
}
