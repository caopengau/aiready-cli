import { similarityScore, estimateTokens } from '@aiready/core';

export interface DuplicatePattern {
  file1: string;
  file2: string;
  line1: number;
  line2: number;
  similarity: number;
  snippet: string;
  patternType: PatternType;
  tokenCost: number;
  linesOfCode: number;
}

export type PatternType =
  | 'function'
  | 'class-method'
  | 'api-handler'
  | 'validator'
  | 'utility'
  | 'component'
  | 'unknown';

interface FileContent {
  file: string;
  content: string;
}

interface DetectionOptions {
  minSimilarity: number;
  minLines: number;
  maxBlocks?: number;
  batchSize?: number;
  approx?: boolean; // Use approximate candidate selection to reduce comparisons
  minSharedTokens?: number; // Minimum shared tokens to consider a candidate
  maxCandidatesPerBlock?: number; // Cap candidates per block
  fastMode?: boolean; // Use fast Jaccard similarity instead of Levenshtein (default true)
  maxComparisons?: number; // Maximum total comparisons budget
  streamResults?: boolean; // Output duplicates as they're found (useful for slow mode)
}

interface CodeBlock {
  content: string;
  startLine: number;
  file: string;
  normalized: string;
  patternType: PatternType;
  tokenCost: number;
  linesOfCode: number;
}

/**
 * Categorize code pattern based on content heuristics
 */
function categorizePattern(code: string): PatternType {
  const lower = code.toLowerCase();
  
  // API handler patterns
  if (
    (lower.includes('request') && lower.includes('response')) ||
    lower.includes('router.') ||
    lower.includes('app.get') ||
    lower.includes('app.post') ||
    lower.includes('express') ||
    lower.includes('ctx.body')
  ) {
    return 'api-handler';
  }
  
  // Validator patterns
  if (
    lower.includes('validate') ||
    lower.includes('schema') ||
    lower.includes('zod') ||
    lower.includes('yup') ||
    (lower.includes('if') && lower.includes('throw'))
  ) {
    return 'validator';
  }
  
  // Component patterns (React, Vue, etc.)
  if (
    lower.includes('return (') ||
    lower.includes('jsx') ||
    lower.includes('component') ||
    lower.includes('props')
  ) {
    return 'component';
  }
  
  // Class methods
  if (lower.includes('class ') || lower.includes('this.')) {
    return 'class-method';
  }
  
  // Utility functions (pure functions with clear input/output)
  if (
    lower.includes('return ') &&
    !lower.includes('this') &&
    !lower.includes('new ')
  ) {
    return 'utility';
  }
  
  // Generic function
  if (lower.includes('function') || lower.includes('=>')) {
    return 'function';
  }
  
  return 'unknown';
}

/**
 * Extract function-like blocks from code using improved heuristics
 */
function extractCodeBlocks(content: string, minLines: number): Array<{
  content: string;
  startLine: number;
  patternType: PatternType;
  linesOfCode: number;
}> {
  const lines = content.split('\n');
  const blocks: Array<{
    content: string;
    startLine: number;
    patternType: PatternType;
    linesOfCode: number;
  }> = [];
  
  let currentBlock: string[] = [];
  let blockStart = 0;
  let braceDepth = 0;
  let inFunction = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect function start
    if (
      !inFunction &&
      (trimmed.includes('function ') ||
        trimmed.includes('=>') ||
        trimmed.includes('async ') ||
        /^(export\s+)?(async\s+)?function\s+/.test(trimmed) ||
        /^(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(/.test(trimmed))
    ) {
      inFunction = true;
      blockStart = i;
    }
    
    // Track brace depth
    for (const char of line) {
      if (char === '{') braceDepth++;
      if (char === '}') braceDepth--;
    }

    if (inFunction) {
      currentBlock.push(line);
    }

    // When we close a function block
    if (inFunction && braceDepth === 0 && currentBlock.length >= minLines) {
      const blockContent = currentBlock.join('\n');
      const linesOfCode = currentBlock.filter(
        (l) => l.trim() && !l.trim().startsWith('//')
      ).length;
      
      blocks.push({
        content: blockContent,
        startLine: blockStart + 1,
        patternType: categorizePattern(blockContent),
        linesOfCode,
      });
      
      currentBlock = [];
      inFunction = false;
    } else if (inFunction && braceDepth === 0) {
      // Reset if we're not accumulating enough
      currentBlock = [];
      inFunction = false;
    }
  }

  return blocks;
}

/**
 * Normalize code for comparison
 * - Remove comments
 * - Normalize whitespace
 * - Remove variable names (replace with placeholders)
 * - Keep structure intact
 */
function normalizeCode(code: string): string {
  return (
    code
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalize string literals to generic placeholder
      .replace(/"[^"]*"/g, '"STR"')
      .replace(/'[^']*'/g, "'STR'")
      .replace(/`[^`]*`/g, '`STR`')
      // Normalize numbers
      .replace(/\b\d+\b/g, 'NUM')
      // Normalize whitespace but keep structure
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Fast Jaccard similarity on token sets - O(N+M) instead of O(N×M)
 */
function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }
  
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate structural similarity between two code blocks
 * Uses multiple similarity metrics for better accuracy
 */
function calculateSimilarity(block1: string, block2: string): number {
  const norm1 = normalizeCode(block1);
  const norm2 = normalizeCode(block2);
  
  // Basic Levenshtein similarity
  const baseSimilarity = similarityScore(norm1, norm2);
  
  // Token-based similarity (split by keywords/operators)
  const tokens1 = norm1.split(/[\s(){}[\];,]+/).filter(Boolean);
  const tokens2 = norm2.split(/[\s(){}[\];,]+/).filter(Boolean);
  const tokenSimilarity = similarityScore(tokens1.join(' '), tokens2.join(' '));
  
  // Weighted average favoring token similarity
  return baseSimilarity * 0.4 + tokenSimilarity * 0.6;
}

/**
 * Detect duplicate patterns across files with enhanced analysis
 */
export async function detectDuplicatePatterns(
  files: FileContent[],
  options: DetectionOptions
): Promise<DuplicatePattern[]> {
  const {
    minSimilarity,
    minLines,
    maxBlocks = 500,
    batchSize = 100,
    approx = true,
    minSharedTokens = 8,
    maxCandidatesPerBlock = 100,
    fastMode = true,
    maxComparisons = 50000, // Cap at 50K comparisons by default
    streamResults = false,
  } = options;
  const duplicates: DuplicatePattern[] = [];

  // Extract blocks from all files
  let allBlocks: CodeBlock[] = files.flatMap((file) =>
    extractCodeBlocks(file.content, minLines).map((block) => ({
      ...block,
      file: file.file,
      normalized: normalizeCode(block.content),
      tokenCost: estimateTokens(block.content),
    }))
  );

  console.log(`Extracted ${allBlocks.length} code blocks for analysis`);

  // Limit blocks to prevent OOM
  if (allBlocks.length > maxBlocks) {
    console.log(`⚠️  Limiting to ${maxBlocks} blocks (sorted by size) to prevent memory issues`);
    console.log(`   Use --max-blocks to increase limit or --min-lines to filter smaller blocks`);
    allBlocks = allBlocks
      .sort((a, b) => b.linesOfCode - a.linesOfCode)
      .slice(0, maxBlocks);
  }

  // Tokenize blocks for candidate selection
  const stopwords = new Set([
    'return', 'const', 'let', 'var', 'function', 'class', 'new', 'if', 'else', 'for', 'while',
    'async', 'await', 'try', 'catch', 'switch', 'case', 'default', 'import', 'export', 'from',
    'true', 'false', 'null', 'undefined', 'this'
  ]);
  const tokenize = (norm: string): string[] =>
    norm
      .split(/[\s(){}\[\];,\.]+/)
      .filter((t) => t && t.length >= 3 && !stopwords.has(t.toLowerCase()));

  const blockTokens: string[][] = allBlocks.map((b) => tokenize(b.normalized));

  // Build inverted index token -> block ids (for approx mode)
  const invertedIndex: Map<string, number[]> = new Map();
  if (approx) {
    for (let i = 0; i < blockTokens.length; i++) {
      for (const tok of blockTokens[i]) {
        let arr = invertedIndex.get(tok);
        if (!arr) {
          arr = [];
          invertedIndex.set(tok, arr);
        }
        arr.push(i);
      }
    }
  }

  // Process comparisons (exact or approximate) in batches to reduce memory pressure
  const totalComparisons = approx
    ? undefined
    : (allBlocks.length * (allBlocks.length - 1)) / 2;
  if (totalComparisons !== undefined) {
    console.log(`Processing ${totalComparisons.toLocaleString()} comparisons in batches...`);
  } else {
    console.log(`Using approximate candidate selection to reduce comparisons...`);
  }

  let comparisonsProcessed = 0;
  let comparisonsBudgetExhausted = false;
  const startTime = Date.now();

  for (let i = 0; i < allBlocks.length; i++) {
    if (maxComparisons && comparisonsProcessed >= maxComparisons) {
      comparisonsBudgetExhausted = true;
      break;
    }
    // Progress reporting every batch
    if (i % batchSize === 0 && i > 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const duplicatesFound = duplicates.length;
      if (totalComparisons !== undefined) {
        const progress = ((comparisonsProcessed / totalComparisons) * 100).toFixed(1);
        const remaining = totalComparisons - comparisonsProcessed;
        const rate = comparisonsProcessed / parseFloat(elapsed);
        const eta = remaining > 0 ? (remaining / rate).toFixed(0) : 0;
        console.log(`   ${progress}% (${comparisonsProcessed.toLocaleString()}/${totalComparisons.toLocaleString()} comparisons, ${elapsed}s elapsed, ~${eta}s remaining, ${duplicatesFound} duplicates)`);
      } else {
        console.log(`   Processed ${i.toLocaleString()}/${allBlocks.length} blocks (${elapsed}s elapsed, ${duplicatesFound} duplicates)`);
      }
      // Allow garbage collection between batches
      await new Promise((resolve) => setImmediate(resolve));
    }

    const block1 = allBlocks[i];

    // Build candidate list (approx mode)
    let candidates: Array<{ j: number; shared: number }> | null = null;
    if (approx) {
      const counts: Map<number, number> = new Map();
      for (const tok of blockTokens[i]) {
        const ids = invertedIndex.get(tok);
        if (!ids) continue;
        for (const j of ids) {
          if (j <= i) continue; // only forward pairs
          if (allBlocks[j].file === block1.file) continue; // skip same-file
          counts.set(j, (counts.get(j) || 0) + 1);
        }
      }
      candidates = Array.from(counts.entries())
        .filter(([, shared]) => shared >= minSharedTokens)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxCandidatesPerBlock)
        .map(([j, shared]) => ({ j, shared }));
    }

    if (approx && candidates) {
      for (const { j } of candidates) {
        if (maxComparisons && comparisonsProcessed >= maxComparisons) break;
        comparisonsProcessed++;
        const block2 = allBlocks[j];

        // Optional: skip cross-type comparisons unless unknown
        // if (block1.patternType !== block2.patternType &&
        //     block1.patternType !== 'unknown' && block2.patternType !== 'unknown') continue;

        const similarity = fastMode
          ? jaccardSimilarity(blockTokens[i], blockTokens[j])
          : calculateSimilarity(block1.content, block2.content);
        if (similarity >= minSimilarity) {
          const duplicate = {
            file1: block1.file,
            file2: block2.file,
            line1: block1.startLine,
            line2: block2.startLine,
            similarity,
            snippet: block1.content.split('\n').slice(0, 5).join('\n') + '\n...',
            patternType: block1.patternType,
            tokenCost: block1.tokenCost + block2.tokenCost,
            linesOfCode: block1.linesOfCode,
          };
          duplicates.push(duplicate);
          
          if (streamResults) {
            console.log(`\n   ✅ Found: ${duplicate.patternType} ${Math.round(similarity * 100)}% similar`);
            console.log(`      ${duplicate.file1}:${duplicate.line1} ⇔ ${duplicate.file2}:${duplicate.line2}`);
            console.log(`      Token cost: ${duplicate.tokenCost.toLocaleString()}`);
          }
        }
      }
    } else {
      // Exact mode: compare against all subsequent blocks
      for (let j = i + 1; j < allBlocks.length; j++) {
        if (maxComparisons && comparisonsProcessed >= maxComparisons) break;
        comparisonsProcessed++;
        const block2 = allBlocks[j];

        // Skip comparing blocks from the same file
        if (block1.file === block2.file) continue;

        // Optional: skip cross-type comparisons unless unknown
        // if (block1.patternType !== block2.patternType &&
        //     block1.patternType !== 'unknown' && block2.patternType !== 'unknown') continue;

        const similarity = fastMode
          ? jaccardSimilarity(blockTokens[i], blockTokens[j])
          : calculateSimilarity(block1.content, block2.content);
        if (similarity >= minSimilarity) {
          const duplicate = {
            file1: block1.file,
            file2: block2.file,
            line1: block1.startLine,
            line2: block2.startLine,
            similarity,
            snippet: block1.content.split('\n').slice(0, 5).join('\n') + '\n...',
            patternType: block1.patternType,
            tokenCost: block1.tokenCost + block2.tokenCost,
            linesOfCode: block1.linesOfCode,
          };
          duplicates.push(duplicate);
          
          if (streamResults) {
            console.log(`\n   ✅ Found: ${duplicate.patternType} ${Math.round(similarity * 100)}% similar`);
            console.log(`      ${duplicate.file1}:${duplicate.line1} ⇔ ${duplicate.file2}:${duplicate.line2}`);
            console.log(`      Token cost: ${duplicate.tokenCost.toLocaleString()}`);
          }
        }
      }
    }
  }

  if (comparisonsBudgetExhausted) {
    console.log(`⚠️  Comparison budget exhausted (${maxComparisons.toLocaleString()} comparisons). Use --max-comparisons to increase.`);
  }

  // Sort by similarity descending, then by token cost
  return duplicates.sort(
    (a, b) => b.similarity - a.similarity || b.tokenCost - a.tokenCost
  );
}
