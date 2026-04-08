import type { ToolScoringOutput } from '@aiready/core';
import { runConfiguredToolCommand } from '../../utils/helpers';

export interface ConfiguredToolActionConfig<TReport> {
  defaults: Record<string, unknown>;
  analyze: (scanOptions: any) => Promise<TReport>;
  getExtras: (
    options: any,
    merged: Record<string, unknown>
  ) => Record<string, unknown>;
  score: (report: TReport) => ToolScoringOutput;
  renderConsole: (report: TReport, scoring: ToolScoringOutput) => void;
}

export async function runConfiguredToolAction<TReport>(
  directory: string,
  options: any,
  config: ConfiguredToolActionConfig<TReport>
): Promise<ToolScoringOutput | undefined> {
  const { report, scoring } = await runConfiguredToolCommand({
    directory,
    options,
    defaults: config.defaults,
    analyze: config.analyze,
    getExtras: config.getExtras,
    score: config.score,
  });

  if (options.output === 'json') {
    return scoring;
  }

  config.renderConsole(report, scoring);
  return scoring;
}
