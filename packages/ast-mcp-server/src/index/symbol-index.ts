import { projectManager } from '../project-manager.js';
import { IndexingStats, SymbolKind } from '../types.js';
import { validateWorkspacePath } from '../security.js';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { Node } from 'ts-morph';

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  column: number;
  exported: boolean;
}

export interface DiskCache {
  version: 1;
  rootDir: string;
  builtAt: string;
  fileHashes: Record<string, number>; // file -> mtimeMs
  symbols: Record<string, SymbolEntry[]>;
}

export class SymbolIndex {
  private index: Record<string, SymbolEntry[]> = {};

  private getCachePath(rootDir: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(rootDir)
      .digest('hex')
      .slice(0, 12);
    return path.join(
      process.platform === 'win32' ? process.env.TEMP || 'c:/temp' : '/tmp',
      `ast-index-${hash}.json`
    );
  }

  private isCacheValid(cached: DiskCache, rootDir: string): boolean {
    if (cached.rootDir !== rootDir) return false;

    for (const [file, cachedMtime] of Object.entries(cached.fileHashes)) {
      if (!fs.existsSync(file)) return false;
      if (fs.statSync(file).mtimeMs !== cachedMtime) return false;
    }

    return true;
  }

  private computeStats(
    cache: DiskCache,
    duration_ms?: number,
    memory_mb?: number
  ): IndexingStats {
    const files = Object.keys(cache.fileHashes).length;
    let functions = 0;
    let classes = 0;
    let interfaces = 0;
    let types = 0;

    for (const entries of Object.values(cache.symbols)) {
      for (const entry of entries) {
        if (entry.kind === 'function' || entry.kind === 'method') functions++;
        if (entry.kind === 'class') classes++;
        if (entry.kind === 'interface') interfaces++;
        if (entry.kind === 'type_alias') types++;
      }
    }

    return {
      indexed: {
        files,
        functions,
        classes,
        interfaces,
        types,
      },
      duration_ms: duration_ms || 0,
      memory_mb: memory_mb || 0,
    };
  }

  private mapKind(node: Node): SymbolKind {
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

  /**
   * Build/Warm the index for a given path
   */
  public async buildIndex(rootDir: string): Promise<IndexingStats> {
    const startTime = Date.now();
    const safeRoot = validateWorkspacePath(rootDir);
    const cachePath = this.getCachePath(safeRoot);

    if (fs.existsSync(cachePath)) {
      try {
        const cached: DiskCache = JSON.parse(
          fs.readFileSync(cachePath, 'utf-8')
        );
        if (this.isCacheValid(cached, safeRoot)) {
          this.index = cached.symbols;
          return this.computeStats(
            cached,
            Date.now() - startTime,
            process.memoryUsage().heapUsed / 1024 / 1024
          );
        }
      } catch {
        // Corrupt cache, ignore
      }
    }

    const tsconfigs = await projectManager.getProjectsForPath(safeRoot);
    const symbols: Record<string, SymbolEntry[]> = {};
    const fileHashes: Record<string, number> = {};

    for (const config of tsconfigs) {
      const project = projectManager.ensureProject(config);
      // We need to force load files for indexing
      project.addSourceFilesFromTsConfig(config);

      for (const sourceFile of project.getSourceFiles()) {
        const filePath = sourceFile.getFilePath();
        try {
          fileHashes[filePath] = fs.statSync(filePath).mtimeMs;
        } catch {
          continue;
        }

        // Extract exported declarations
        for (const [name, decls] of sourceFile.getExportedDeclarations()) {
          for (const decl of decls) {
            const entry: SymbolEntry = {
              name,
              kind: this.mapKind(decl as Node),
              file: filePath,
              line: decl.getStartLineNumber(),
              column: decl.getStart() - decl.getStartLinePos(),
              exported: true,
            };
            (symbols[name] ||= []).push(entry);
          }
        }

        // Extract non-exported top-level declarations
        for (const fn of sourceFile.getFunctions()) {
          const name = fn.getName();
          if (
            name &&
            !symbols[name]?.some(
              (s) => s.file === filePath && s.line === fn.getStartLineNumber()
            )
          ) {
            const entry: SymbolEntry = {
              name,
              kind: 'function',
              file: filePath,
              line: fn.getStartLineNumber(),
              column: fn.getStart() - fn.getStartLinePos(),
              exported: false,
            };
            (symbols[name] ||= []).push(entry);
          }
        }
        for (const cls of sourceFile.getClasses()) {
          const name = cls.getName();
          if (
            name &&
            !symbols[name]?.some(
              (s) => s.file === filePath && s.line === cls.getStartLineNumber()
            )
          ) {
            const entry: SymbolEntry = {
              name,
              kind: 'class',
              file: filePath,
              line: cls.getStartLineNumber(),
              column: cls.getStart() - cls.getStartLinePos(),
              exported: false,
            };
            (symbols[name] ||= []).push(entry);
          }
        }
      }
    }

    const cache: DiskCache = {
      version: 1,
      rootDir: safeRoot,
      builtAt: new Date().toISOString(),
      fileHashes,
      symbols,
    };

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache));

    this.index = symbols;

    const duration = Date.now() - startTime;
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

    return this.computeStats(cache, duration, Math.round(memoryUsage));
  }

  public isInitialized(): boolean {
    return Object.keys(this.index).length > 0;
  }

  public lookup(name: string): SymbolEntry[] {
    return this.index[name] || [];
  }

  public lookupByFile(file: string): SymbolEntry[] {
    return Object.values(this.index)
      .flat()
      .filter((e) => e.file === file);
  }
}

export const symbolIndex = new SymbolIndex();
