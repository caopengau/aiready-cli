import { TSESTree } from '@typescript-eslint/typescript-estree';
import { ExportWithImports, FileImport } from '../types/ast';

/**
 * Extract all imports from a TypeScript/JavaScript AST.
 * Analyzes ImportDeclarations to identify source modules and specific symbols.
 *
 * @param ast - The program AST to analyze
 * @returns Array of identified file imports
 */
export function extractFileImports(ast: TSESTree.Program): FileImport[] {
  const imports: FileImport[] = [];

  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      const source = node.source.value as string;
      const specifiers: string[] = [];
      const isTypeOnly = node.importKind === 'type';

      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          const imported = spec.imported;
          const importName =
            imported.type === 'Identifier'
              ? imported.name
              : (imported as unknown as { value: string }).value;
          specifiers.push(importName);
        } else if (spec.type === 'ImportDefaultSpecifier') {
          specifiers.push('default');
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          specifiers.push('*');
        }
      }

      imports.push({ source, specifiers, isTypeOnly });
    }
  }

  return imports;
}

/**
 * Extract named and default exports from an AST along with their import dependencies.
 *
 * @param ast - The program AST to analyze
 * @param fileImports - Pre-extracted imports to check for dependencies
 * @returns Array of exports with metadata and identified dependencies
 */
export function extractExportsWithDependencies(
  ast: TSESTree.Program,
  fileImports: FileImport[]
): ExportWithImports[] {
  const exports: ExportWithImports[] = [];
  const importedNames = new Set(fileImports.flatMap((imp) => imp.specifiers));

  for (const node of ast.body) {
    if (node.type === 'ExportNamedDeclaration') {
      const source = node.source?.value as string | undefined;

      if (node.declaration) {
        const exportNodes = extractFromDeclaration(node.declaration);
        for (const exp of exportNodes) {
          const usedImports = findUsedImports(node.declaration, importedNames);
          const typeReferences = extractTypeReferences(node.declaration);
          exports.push({
            ...exp,
            source,
            imports: usedImports,
            dependencies: [],
            typeReferences,
            loc: node.loc,
          });
        }
      } else if (node.specifiers.length > 0) {
        // Handle re-exports like: export { x } from './y'
        for (const spec of node.specifiers) {
          if (spec.type === 'ExportSpecifier') {
            const name =
              spec.exported.type === 'Identifier'
                ? (spec.exported as { name: string }).name
                : (spec.exported as unknown as { value: string }).value;
            exports.push({
              name,
              type: 'const' as ExportWithImports['type'], // Simplified, could be any type from source
              source,
              imports: [],
              dependencies: [],
              typeReferences: [],
              loc: node.loc,
            });
          }
        }
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      const usedImports = findUsedImports(node.declaration, importedNames);
      const typeReferences = extractTypeReferences(node.declaration);
      exports.push({
        name: 'default',
        type: 'default' as ExportWithImports['type'],
        imports: usedImports,
        dependencies: [],
        typeReferences: [],
        loc: node.loc,
      });
    } else if (node.type === 'ExportAllDeclaration') {
      // Handle export * from './y'
      const source = (node as { source: { value: string } }).source.value;
      let name = '*';

      if (node.exported) {
        name =
          node.exported.type === 'Identifier'
            ? (node.exported as { name: string }).name
            : (node.exported as unknown as { value: string }).value;
      }

      exports.push({
        name,
        type: 'all' as ExportWithImports['type'],
        source,
        imports: [],
        dependencies: [],
        typeReferences: [],
        loc: node.loc,
      });
    }
  }

  return exports;
}

/**
 * Extract individual export names and types from a declaration node.
 * Handles functions, classes, variables, interfaces, and types.
 *
 * @param node - The declaration node within an export
 * @returns Array of simplified export info objects
 */
export function extractFromDeclaration(
  node: TSESTree.ExportNamedDeclaration['declaration']
): Array<{ name: string; type: ExportWithImports['type'] }> {
  if (!node) return [];

  const results: Array<{ name: string; type: ExportWithImports['type'] }> = [];

  if (node.type === 'FunctionDeclaration' && node.id) {
    results.push({ name: node.id.name, type: 'function' });
  } else if (node.type === 'ClassDeclaration' && node.id) {
    results.push({ name: node.id.name, type: 'class' });
  } else if (node.type === 'VariableDeclaration') {
    for (const decl of node.declarations) {
      if (decl.id.type === 'Identifier') {
        results.push({ name: decl.id.name, type: 'const' });
      }
    }
  } else if (node.type === 'TSInterfaceDeclaration' && node.id) {
    results.push({ name: node.id.name, type: 'interface' });
  } else if (node.type === 'TSTypeAliasDeclaration' && node.id) {
    results.push({ name: node.id.name, type: 'type' });
  }

  return results;
}

/**
 * Find which imports from the file are used within a specific code block (AST node).
 *
 * @param node - The AST node to scan for usages
 * @param importedNames - Set of all identifiers imported into the file
 * @returns Array of imported names used by the given node
 */
export function findUsedImports(
  node: TSESTree.Node,
  importedNames: Set<string>
): string[] {
  const usedImports = new Set<string>();

  function visit(n: TSESTree.Node) {
    if (n.type === 'Identifier' && importedNames.has(n.name)) {
      usedImports.add(n.name);
    }

    // Recursively visit child nodes
    for (const key in n) {
      if (key === 'parent') continue;
      const value = (n as unknown as Record<string, unknown>)[key];
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((child) => {
            if (child && typeof child === 'object' && 'type' in child) {
              visit(child as TSESTree.Node);
            }
          });
        } else if ('type' in value) {
          visit(value as TSESTree.Node);
        }
      }
    }
  }

  visit(node);
  return Array.from(usedImports);
}

/**
 * Extract TypeScript type references from a node.
 * Collects all type identifiers used in type annotations to understand
 * high-level dependency on core types or external interfaces.
 *
 * @param node - The AST node to scan for type references
 * @returns Array of type identifier names found
 */
export function extractTypeReferences(node: TSESTree.Node): string[] {
  const types = new Set<string>();

  function visit(n: any) {
    if (!n || typeof n !== 'object') return;

    // Type references
    if (n.type === 'TSTypeReference' && n.typeName) {
      if (n.typeName.type === 'Identifier') {
        types.add(n.typeName.name);
      } else if (n.typeName.type === 'TSQualifiedName') {
        // Handle qualified names like A.B.C
        let current = n.typeName;
        while (current.type === 'TSQualifiedName') {
          if (current.right?.type === 'Identifier') {
            types.add(current.right.name);
          }
          current = current.left;
        }
        if (current.type === 'Identifier') {
          types.add(current.name);
        }
      }
    }

    // Interface references
    if (n.type === 'TSInterfaceHeritage' && n.expression) {
      if (n.expression.type === 'Identifier') {
        types.add(n.expression.name);
      }
    }

    // Recursively visit children
    for (const key of Object.keys(n)) {
      if (key === 'parent') continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  }

  visit(node);
  return Array.from(types);
}
