import * as Parser from 'web-tree-sitter';
import type { ExportInfo } from '../types/language';

export interface AnalyzeOptions {
  sideEffectSignatures?: string[];
}

export function analyzeNodeMetadata(
  node: Parser.Node,
  code?: string,
  options?: AnalyzeOptions
): Partial<ExportInfo> {
  const metadata: Partial<ExportInfo> = {
    isPure: true,
    hasSideEffects: false,
  };

  // Collect documentation/comments immediately above the node
  try {
    let prev: Parser.Node | null = node.previousSibling;
    while (prev && /comment/i.test(prev.type)) {
      const text = prev.text || '';
      const loc = {
        start: {
          line: prev.startPosition.row + 1,
          column: prev.startPosition.column,
        },
        end: {
          line: prev.endPosition.row + 1,
          column: prev.endPosition.column,
        },
      };

      // Prefer structured doc comments when available
      if (text.trim().startsWith('/**') || text.trim().startsWith('/*')) {
        metadata.documentation = {
          content: text.replace(/^[/*]+|[/*]+$/g, '').trim(),
          type: 'comment',
          loc,
        };
        break;
      }
      if (text.trim().startsWith('///')) {
        metadata.documentation = {
          content: text.replace(/^\/\/\//, '').trim(),
          type: 'xml-doc',
          loc,
        };
        break;
      }
      if (text.trim().startsWith('//')) {
        metadata.documentation = {
          content: text.replace(/^\/\//, '').trim(),
          type: 'comment',
          loc,
        };
        break;
      }
      prev = prev.previousSibling;
    }

    // Language-specific: Python docstrings (inside body)
    if (
      node.type === 'function_definition' ||
      node.type === 'class_definition'
    ) {
      const body =
        node.childForFieldName('body') ||
        node.children.find((c) => c.type === 'block');

      if (body && body.children.length > 0) {
        const firstStmt = body.children[0];
        if (
          firstStmt.type === 'expression_statement' &&
          firstStmt.firstChild?.type === 'string'
        ) {
          metadata.documentation = {
            content: firstStmt.firstChild.text.replace(/['"`]/g, '').trim(),
            type: 'docstring',
            loc: {
              start: {
                line: firstStmt.startPosition.row + 1,
                column: firstStmt.startPosition.column,
              },
              end: {
                line: firstStmt.endPosition.row + 1,
                column: firstStmt.endPosition.column,
              },
            },
          };
        }
      }
    }
  } catch {
    // best-effort
  }

  // Default side-effect signatures (language-agnostic common sinks)
  const defaultSignatures = [
    'console.',
    'fmt.',
    'panic(',
    'os.Exit',
    'log.',
    'Console.Write',
    'File.Write',
    'System.out',
    'System.err',
    'Files.write',
    'process.exit',
    'exit(',
  ];

  const signatures = Array.from(
    new Set([...(options?.sideEffectSignatures || []), ...defaultSignatures])
  );

  const walk = (n: Parser.Node) => {
    try {
      const t = n.type || '';

      if (
        /assign|assignment|assignment_statement|assignment_expression|throw|throw_statement|send_statement|global_statement|nonlocal_statement/i.test(
          t
        )
      ) {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }

      const text = n.text || '';
      for (const s of signatures) {
        if (text.includes(s)) {
          metadata.isPure = false;
          metadata.hasSideEffects = true;
          break;
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        const c = n.child(i);
        if (c) walk(c);
      }
    } catch {
      // ignore traversal errors
    }
  };

  // Find likely function/body node
  const body =
    node.childForFieldName('body') ||
    node.children.find((c) =>
      /body|block|class_body|declaration_list|function_body/.test(c.type)
    );
  if (body) walk(body);

  return metadata;
}
