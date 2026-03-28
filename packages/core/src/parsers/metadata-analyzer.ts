import * as Parser from 'web-tree-sitter';
import { ExportInfo } from '../types/language';

/**
 * Shared metadata analyzer for language parsers.
 * This helper consolidates heuristic analysis for purity, side effects, and documentation.
 *
 * @param node - AST node to analyze for metadata.
 * @returns Partial ExportInfo object containing discovered metadata.
 * @lastUpdated 2026-03-18
 */
export function analyzeSharedMetadata(node: Parser.Node): Partial<ExportInfo> {
  const metadata: Partial<ExportInfo> = {
    isPure: true,
    hasSideEffects: false,
  };

  const walk = (n: Parser.Node) => {
    // Side-effectful expressions/statements across languages
    if (
      n.type === 'assignment_statement' ||
      n.type === 'assignment_expression' ||
      n.type === 'short_var_declaration' ||
      n.type === 'send_statement' ||
      n.type === 'throw_statement'
    ) {
      metadata.isPure = false;
      metadata.hasSideEffects = true;
    }

    if (
      n.type === 'call_expression' ||
      n.type === 'invocation_expression' ||
      n.type === 'method_invocation'
    ) {
      const text = n.text;
      if (
        text.includes('fmt.Print') ||
        text.includes('os.Exit') ||
        text.includes('panic(') ||
        text.includes('log.') ||
        text.includes('Console.Write') ||
        text.includes('File.Write') ||
        text.includes('System.out.print') ||
        text.includes('System.err.print') ||
        text.includes('Files.write')
      ) {
        metadata.isPure = false;
        metadata.hasSideEffects = true;
      }
    }

    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (child) walk(child);
    }
  };

  // Find a body-like node to analyze
  const body =
    (
      (node as unknown as Record<string, unknown>).childForFieldName as
        | ((name: string) => Parser.Node | null)
        | undefined
    )?.('body') ||
    node.children.find((c) =>
      ['block', 'declaration_list', 'class_body'].includes(c.type)
    );

  if (body) walk(body);

  return metadata;
}
