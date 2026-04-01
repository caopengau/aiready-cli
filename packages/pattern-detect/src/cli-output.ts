import {
  getSeverityBadge,
  getSeverityValue,
  generateTable,
  generateStandardHtmlReport,
} from '@aiready/core';

/**
 * Get emoji icon representing a specific pattern type.
 *
 * @param type - The pattern type string.
 * @returns Emoji icon for the pattern.
 */
export function getPatternIcon(type: string): string {
  const icons: Record<string, string> = {
    'api-handler': '🔌',
    validator: '🛡️',
    utility: '⚙️',
    'class-method': '🏛️',
    component: '🧩',
    function: '𝑓',
    unknown: '❓',
  };
  return icons[type] || icons.unknown;
}

/**
 * Generate a complete HTML report for pattern detection results.
 *
 * @param results - The results object (may be single arg or part of a pair).
 * @param summary - Optional consolidated summary for legacy support.
 * @returns Self-contained HTML string.
 */
export function generateHTMLReport(results: any, summary?: any): string {
  const data = summary
    ? { results, summary, metadata: { version: '0.11.22' } }
    : results;
  const { metadata, summary: s } = data;

  const scoreValue = Math.max(
    0,
    100 - Math.round(((s.duplicates?.length || 0) / (s.totalFiles || 1)) * 20)
  );

  const tableRows = (s.duplicates || []).map((dup: any) => [
    `<span class="${dup.similarity > 0.95 ? 'critical' : dup.similarity > 0.9 ? 'major' : 'minor'}">${Math.round(dup.similarity * 100)}%</span>`,
    dup.patternType,
    dup.files
      .map((f: any) => `<code>${f.path}:${f.startLine}-${f.endLine}</code>`)
      .join('<br>↔<br>'),
    dup.tokenCost.toLocaleString(),
  ]);

  return generateStandardHtmlReport(
    {
      title: 'Pattern Detection Report',
      packageName: 'pattern-detect',
      packageUrl: 'https://github.com/getaiready/aiready-pattern-detect',
      bugUrl: 'https://github.com/getaiready/aiready-pattern-detect/issues',
      version: metadata.version,
      emoji: '🔍',
    },
    [
      { value: s.totalFiles, label: 'Files Analyzed' },
      { value: s.duplicates?.length || 0, label: 'Duplicate Clusters' },
      { value: s.totalIssues, label: 'Total Issues' },
    ],
    [
      {
        title: 'Duplicate Patterns',
        content: generateTable({
          headers: ['Similarity', 'Type', 'Locations', 'Tokens Wasted'],
          rows: tableRows,
        }),
      },
    ],
    { value: `${scoreValue}%`, label: 'AI Ready Score (Deduplication)' }
  );
}

// These are now standardized in @aiready/core
export { getSeverityValue, getSeverityBadge };
