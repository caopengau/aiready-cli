import { Node } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import {
  DefinitionLocation,
  ReferenceLocation,
  FileStructure,
  SymbolKind,
  ClassInfo,
  FunctionInfo,
  InterfaceInfo,
  TypeAliasInfo,
  EnumInfo,
} from '../types.js';
import { projectManager } from '../project-manager.js';
import { symbolIndex } from '../index/symbol-index.js';
import { validateWorkspacePath } from '../security.js';
import { WorkerPool } from '../worker/pool.js';

export class TypeScriptAdapter {
  private pool: WorkerPool;

  constructor() {
    const poolSize = parseInt(process.env.AST_WORKER_POOL_SIZE || '2');
    this.pool = new WorkerPool(poolSize);
  }

  private async ensureIndex(p: string): Promise<void> {
    if (!symbolIndex.isInitialized()) {
      const absolutePath = path.resolve(p);
      let searchPath = absolutePath;

      if (!fs.statSync(absolutePath).isDirectory()) {
        const tsconfig = await projectManager.findNearestTsConfig(absolutePath);
        searchPath = tsconfig
          ? path.dirname(tsconfig)
          : path.dirname(absolutePath);
      }

      console.error(
        `[AST] Index not initialized. Building for ${searchPath}...`
      );
      await symbolIndex.buildIndex(searchPath);
    }
  }

  public async resolveDefinition(
    symbolName: string,
    path: string
  ): Promise<DefinitionLocation[]> {
    validateWorkspacePath(path);
    await this.ensureIndex(path);

    // Fast path: index lookup (O(1)) to find the file
    const indexHits = symbolIndex.lookup(symbolName);
    if (indexHits.length > 0) {
      const results: DefinitionLocation[] = [];
      for (const hit of indexHits) {
        const tsconfig = await projectManager.findNearestTsConfig(hit.file);
        if (tsconfig) {
          const project = projectManager.ensureProject(tsconfig);
          const sourceFile = project.addSourceFileAtPathIfExists(hit.file);
          if (sourceFile) {
            const exported = sourceFile
              .getExportedDeclarations()
              .get(symbolName);
            if (exported && exported.length > 0) {
              results.push(this.mapToDefinitionLocation(exported[0] as Node));
              continue;
            }
          }
        }
        // Fallback if ts-morph loading fails for the hit
        results.push({
          file: hit.file,
          line: hit.line,
          column: hit.column,
          kind: hit.kind,
          snippet: '',
          documentation: undefined,
        });
      }
      return results;
    }

    // Fallback: search specific file via ts-morph (useful for local files without full index)
    if (fs.statSync(path).isDirectory()) {
      return []; // Cannot load a directory as a single file
    }

    const tsconfig = await projectManager.findNearestTsConfig(path);
    if (!tsconfig) return [];

    // Use worker pool for heavy ts-morph operations
    try {
      const result = await this.pool.execute<DefinitionLocation[]>(
        'resolve_definition',
        {
          tsconfig,
          file: path,
          symbol: symbolName,
        }
      );
      return result;
    } catch {
      // Fallback to main thread if worker fails
      const project = projectManager.ensureProject(tsconfig);
      const sourceFile = project.addSourceFileAtPathIfExists(path);
      if (!sourceFile) return [];

      const exported = sourceFile.getExportedDeclarations().get(symbolName);
      if (!exported) return [];

      return exported.map((decl) => this.mapToDefinitionLocation(decl as Node));
    }
  }

  public async findReferences(
    symbolName: string,
    path: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ references: ReferenceLocation[]; total_count: number }> {
    validateWorkspacePath(path);
    await this.ensureIndex(path);

    // Index lookup to find definition location
    const hits = symbolIndex.lookup(symbolName);
    if (hits.length === 0) return { references: [], total_count: 0 };

    // Load only the definition file
    const hit = hits[0];
    const tsconfig = await projectManager.findNearestTsConfig(hit.file);
    if (!tsconfig) return { references: [], total_count: 0 };

    const project = projectManager.ensureProject(tsconfig);
    const sourceFile = project.addSourceFileAtPathIfExists(hit.file);
    if (!sourceFile) return { references: [], total_count: 0 };

    // We need the actual node. Instead of calculating position from line/col, let's just find the exported declaration.
    const exported = sourceFile.getExportedDeclarations().get(symbolName);
    if (!exported || exported.length === 0)
      return { references: [], total_count: 0 };

    const targetNode = exported[0];

    // Hybrid approach: to prevent OOM, we don't load all files in the project.
    // Instead, we use rg to find files that literally contain the symbol name,
    // and only load those into ts-morph for accurate reference resolution.
    try {
      const { searchCode } = await import('../tools/search-code.js');
      const searchResults = await searchCode(
        symbolName,
        path,
        '*.{ts,tsx,js,jsx}',
        1000,
        false
      );
      const filesToLoad = [...new Set(searchResults.map((r) => r.file))];
      for (const file of filesToLoad) {
        project.addSourceFileAtPathIfExists(file);
      }
    } catch (_e) {
      // Ignore search failures - fallback to existing project files
    }

    const refSymbols =
      'findReferences' in targetNode &&
      typeof (targetNode as { findReferences?: () => any[] }).findReferences ===
        'function'
        ? (targetNode as { findReferences: () => any[] }).findReferences()
        : undefined;
    if (!refSymbols) return { references: [], total_count: 0 };

    const results: ReferenceLocation[] = [];
    for (const refSymbol of refSymbols) {
      for (const ref of refSymbol.getReferences()) {
        const sf = ref.getSourceFile();
        const lc = sf.getLineAndColumnAtPos(ref.getTextSpan().getStart());
        results.push({
          file: sf.getFilePath(),
          line: lc.line,
          column: lc.column,
          text: ref.getNode().getParent()?.getText() || ref.getNode().getText(),
        });
      }
    }

    const unique = this.deduplicateLocations(results);
    return {
      references: unique.slice(offset, offset + limit),
      total_count: unique.length,
    };
  }

  public async findImplementations(
    symbolName: string,
    path: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ implementations: ReferenceLocation[]; total_count: number }> {
    validateWorkspacePath(path);
    await this.ensureIndex(path);
    const hits = symbolIndex.lookup(symbolName);
    if (hits.length === 0) return { implementations: [], total_count: 0 };

    const hit = hits[0];
    const tsconfig = await projectManager.findNearestTsConfig(hit.file);
    if (!tsconfig) return { implementations: [], total_count: 0 };

    // Use worker pool for heavy ts-morph operations
    try {
      const result = await this.pool.execute<{
        implementations: ReferenceLocation[];
        total_count: number;
      }>('find_implementations', {
        tsconfig,
        file: hit.file,
        symbol: symbolName,
      });

      // Apply pagination
      return {
        implementations: result.implementations.slice(offset, offset + limit),
        total_count: result.total_count,
      };
    } catch {
      // Fallback to main thread if worker fails
      const project = projectManager.ensureProject(tsconfig);
      const sourceFile = project.addSourceFileAtPathIfExists(hit.file);
      if (!sourceFile) return { implementations: [], total_count: 0 };

      const exported = sourceFile.getExportedDeclarations().get(symbolName);
      if (!exported || exported.length === 0)
        return { implementations: [], total_count: 0 };

      const targetNode = exported[0];
      if (
        !Node.isClassDeclaration(targetNode) &&
        !Node.isInterfaceDeclaration(targetNode)
      ) {
        return { implementations: [], total_count: 0 };
      }

      try {
        const { searchCode } = await import('../tools/search-code.js');
        const searchResults = await searchCode(
          symbolName,
          path,
          '*.{ts,tsx,js,jsx}',
          1000,
          false
        );
        const filesToLoad = [...new Set(searchResults.map((r) => r.file))];
        for (const file of filesToLoad) {
          project.addSourceFileAtPathIfExists(file);
        }
      } catch (_e) {
        // Ignore search failures - fallback to existing project files
      }

      const results: ReferenceLocation[] = [];
      const implementations =
        'getImplementations' in targetNode &&
        typeof (targetNode as { getImplementations?: () => any[] })
          .getImplementations === 'function'
          ? (
              targetNode as { getImplementations: () => any[] }
            ).getImplementations()
          : undefined;
      if (implementations) {
        for (const impl of implementations) {
          const sf = impl.getSourceFile();
          const lc = sf.getLineAndColumnAtPos(impl.getTextSpan().getStart());
          results.push({
            file: sf.getFilePath(),
            line: lc.line,
            column: lc.column,
            text:
              impl.getNode().getParent()?.getText() || impl.getNode().getText(),
          });
        }
      }

      const unique = this.deduplicateLocations(results);
      return {
        implementations: unique.slice(offset, offset + limit),
        total_count: unique.length,
      };
    }
  }

  public async getFileStructure(
    filePath: string
  ): Promise<FileStructure | undefined> {
    const safePath = validateWorkspacePath(filePath);
    const tsconfig = await projectManager.findNearestTsConfig(safePath);
    if (!tsconfig) return undefined;

    const project = projectManager.ensureProject(tsconfig);
    const sourceFile = project.addSourceFileAtPathIfExists(safePath);
    if (!sourceFile) return undefined;

    const structure: FileStructure = {
      file: safePath,
      imports: sourceFile.getImportDeclarations().map((imp) => ({
        module: imp.getModuleSpecifierValue(),
        names: imp.getNamedImports().map((ni) => ni.getName()),
      })),
      exports: sourceFile.getExportSymbols().map((sym) => ({
        name: sym.getName(),
        kind: this.mapSymbolKind(sym),
      })),
      classes: sourceFile.getClasses().map((cls) => this.mapToClassInfo(cls)),
      functions: sourceFile
        .getFunctions()
        .map((fn) => this.mapToFunctionInfo(fn)),
      interfaces: sourceFile
        .getInterfaces()
        .map((itf) => this.mapToInterfaceInfo(itf)),
      typeAliases: sourceFile
        .getTypeAliases()
        .map((ta) => this.mapToTypeAliasInfo(ta)),
      enums: sourceFile.getEnums().map((enm) => this.mapToEnumInfo(enm)),
    };

    return structure;
  }

  public async shutdown(): Promise<void> {
    await this.pool.terminate();
  }

  private mapToDefinitionLocation(node: Node): DefinitionLocation {
    const sourceFile = node.getSourceFile();
    const lineAndColumn = sourceFile.getLineAndColumnAtPos(node.getStart());

    return {
      file: sourceFile.getFilePath(),
      line: lineAndColumn.line,
      column: lineAndColumn.column,
      kind: this.mapNodeToSymbolKind(node),
      snippet: node.getText(),
      documentation: this.getJsDoc(node),
    };
  }

  private mapNodeToSymbolKind(node: Node): SymbolKind {
    if (Node.isClassDeclaration(node)) return 'class';
    if (Node.isFunctionDeclaration(node)) return 'function';
    if (Node.isInterfaceDeclaration(node)) return 'interface';
    if (Node.isTypeAliasDeclaration(node)) return 'type_alias';
    if (Node.isEnumDeclaration(node)) return 'enum';
    if (Node.isVariableDeclaration(node)) return 'variable';
    if (Node.isMethodDeclaration(node)) return 'method';
    if (Node.isPropertyDeclaration(node)) return 'property';
    if (Node.isParameterDeclaration(node)) return 'parameter';
    return 'variable';
  }

  private mapSymbolKind(symbol: any): SymbolKind {
    const decls = symbol.getDeclarations();
    if (decls.length > 0) return this.mapNodeToSymbolKind(decls[0]);
    return 'variable';
  }

  private getJsDoc(node: Node): string | undefined {
    if (Node.isJSDocable(node)) {
      const docs = node.getJsDocs();
      if (docs.length > 0) {
        return docs[0].getCommentText();
      }
    }
    return undefined;
  }

  public getSymbolDocs(node: Node) {
    if (Node.isJSDocable(node)) {
      const docs = node.getJsDocs();
      if (docs.length > 0) {
        const doc = docs[0];
        return {
          documentation: doc.getCommentText(),
          tags: doc.getTags().map((tag) => ({
            name: tag.getTagName(),
            text: tag.getCommentText() || '',
          })),
        };
      }
    }
    return undefined;
  }

  private mapToClassInfo(cls: any): ClassInfo {
    return {
      name: cls.getName() || 'anonymous',
      ...this.getSymbolDocs(cls),
      methods: cls.getMethods().map((m: any) => this.mapToFunctionInfo(m)),
      properties: cls
        .getProperties()
        .map((p: any) => this.mapToPropertyInfo(p)),
    };
  }

  private mapToFunctionInfo(fn: unknown): FunctionInfo {
    return {
      name: (fn as any)?.getName?.() || 'anonymous',
      ...this.getSymbolDocs(fn as any),
      params: ((fn as any)?.getParameters?.() || []).map((p: any) => ({
        name: p.getName(),
        type: p.getType().getText(),
      })),
      returnType: (fn as any)?.getReturnType?.()?.getText?.() || 'unknown',
    };
  }

  private mapToPropertyInfo(p: unknown) {
    return {
      name: (p as any)?.getName?.() || 'unknown',
      type: (p as any)?.getType?.()?.getText?.() || 'unknown',
      ...this.getSymbolDocs(p as any),
    };
  }

  private mapToInterfaceInfo(itf: unknown): InterfaceInfo {
    return {
      name: (itf as any)?.getName?.() || 'unknown',
      ...this.getSymbolDocs(itf as any),
      properties:
        ((itf as any).getProperties?.() || []).map((p: any) =>
          this.mapToPropertyInfo(p)
        ) || [],
      methods:
        ((itf as any)?.getMethods?.() || []).map((m: any) =>
          this.mapToFunctionInfo(m)
        ) || [],
    };
  }

  private mapToTypeAliasInfo(ta: unknown): TypeAliasInfo {
    return {
      name: (ta as any)?.getName?.() || 'unknown',
      type: (ta as any)?.getType?.()?.getText?.() || 'unknown',
      ...this.getSymbolDocs(ta as Node),
    };
  }

  private mapToEnumInfo(enm: unknown): EnumInfo {
    return {
      name: (enm as any)?.getName?.() || 'unknown',
      ...this.getSymbolDocs(enm as Node),
      members:
        ((enm as any)?.getMembers?.() || []).map((m: any) => m.getName()) || [],
    };
  }

  private deduplicateLocations<
    T extends { file: string; line: number; column: number },
  >(locations: T[]): T[] {
    const seen = new Set<string>();
    return locations.filter((loc) => {
      const key = `${loc.file}:${loc.line}:${loc.column}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const typescriptAdapter = new TypeScriptAdapter();
