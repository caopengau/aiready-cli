/**
 * Language-agnostic scanner for AI signal clarity signals.
 *
 * Detects code patterns that empirically cause AI models to generate
 * incorrect code across all supported languages (TS, Python, Java, C#, Go).
 */

import { readFileSync } from 'fs';
import { getParser } from '@aiready/core';
import type {
  FileAiSignalClarityResult,
  AiSignalClarityOptions,
} from './types';

import { detectExportSignals } from './signals/exports';
import { detectStructuralSignals } from './signals/visitor';
import type { SignalContext, SignalResult } from './signals/types';

// ---------------------------------------------------------------------------
// Main scanner
// ---------------------------------------------------------------------------

export async function scanFile(
  filePath: string,
  options: AiSignalClarityOptions = { rootDir: '.' }
): Promise<FileAiSignalClarityResult> {
  let code: string;
  try {
    code = readFileSync(filePath, 'utf-8');
  } catch {
    return emptyResult(filePath);
  }

  const parser = await getParser(filePath);
  if (!parser) return emptyResult(filePath);

  try {
    await parser.initialize();
    const parseResult = parser.parse(code, filePath);
    const ast = await parser.getAST(code, filePath);

    const lineCount = code.split('\n').length;

    // Build domain vocabulary for context-aware checks
    // For single file scan, we just use the current file's vocabulary
    const domainVocabulary = new Set<string>();
    for (const imp of parseResult.imports) {
      for (const spec of imp.specifiers) {
        if (spec && spec !== '*' && spec !== 'default') {
          domainVocabulary.add(spec.toLowerCase());
        }
      }
    }
    for (const exp of parseResult.exports) {
      if (exp.name && exp.name !== 'default') {
        domainVocabulary.add(exp.name.toLowerCase());
      }
    }

    const ctx: SignalContext = {
      filePath,
      code,
      lineCount,
      options,
      domainVocabulary, // Add domain vocabulary to context
    };

    // 1. Detect Export and File-level signals
    const exportResult = detectExportSignals(ctx, parseResult);

    // 2. Detect Structural signals (Magic literals, Boolean traps, etc.)
    let structuralResult: SignalResult = { issues: [], signals: {} };
    if (ast) {
      structuralResult = detectStructuralSignals(ctx, ast);
    }

    const allIssues = [...exportResult.issues, ...structuralResult.issues];
    const combinedSignals = {
      ...exportResult.signals,
      ...structuralResult.signals,
      totalSymbols: parseResult.exports.length + parseResult.imports.length,
      totalExports: parseResult.exports.length,
      totalLines: lineCount,
    };

    return {
      fileName: filePath,
      issues: allIssues,
      signals: combinedSignals,
      metrics: {
        totalSymbols: parseResult.exports.length + parseResult.imports.length,
        totalExports: parseResult.exports.length,
      },
    };
  } catch (error) {
    console.error(`AI Signal Clarity: Failed to scan ${filePath}: ${error}`);
    return emptyResult(filePath);
  }
}

function emptyResult(filePath: string): FileAiSignalClarityResult {
  const aggregateSignals: any = {
    magicLiterals: 0,
    booleanTraps: 0,
    ambiguousNames: 0,
    undocumentedExports: 0,
    implicitSideEffects: 0,
    deepCallbacks: 0,
    overloadedSymbols: 0,
    largeFiles: 0,
    totalSymbols: 0,
    totalExports: 0,
    totalLines: 0,
  };

  return {
    fileName: filePath,
    issues: [],
    signals: aggregateSignals,
    metrics: {
      totalSymbols: 0,
      totalExports: 0,
    },
  };
}
