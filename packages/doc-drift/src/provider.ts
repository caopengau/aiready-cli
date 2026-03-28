import {
  createProvider,
  ToolName,
  ScanOptions,
  groupIssuesByFile,
  buildSimpleProviderScore,
} from '@aiready/core';
import { analyzeDocDrift } from './analyzer';
import { DocDriftOptions } from './types';

/**
 * Documentation Drift Tool Provider
 */
export const DocDriftProvider = createProvider({
  id: ToolName.DocDrift,
  alias: ['doc-drift', 'docs', 'jsdoc'],
  version: '0.9.5',
  defaultWeight: 8,
  async analyzeReport(options: ScanOptions) {
    return analyzeDocDrift(options as DocDriftOptions);
  },
  getResults(report) {
    return groupIssuesByFile(report.issues);
  },
  getSummary(report) {
    return report.summary;
  },
  getMetadata(report) {
    return { rawData: report.rawData };
  },
  score(output) {
    const summary = output.summary;
    const rawData = output.metadata?.rawData || {};
    return buildSimpleProviderScore(ToolName.DocDrift, summary, rawData);
  },
});
