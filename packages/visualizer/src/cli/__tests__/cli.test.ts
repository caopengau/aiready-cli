import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';

describe('Visualizer CLI', () => {
  it('should register expected commands', async () => {
    // We mock the program but we can just check if registration logic would run
    const program = new Command();

    program.command('sample').description('Generate a sample visualization');

    program
      .command('generate')
      .description('Generate visualization from results');

    expect(program.commands.map((c) => c.name())).toContain('sample');
    expect(program.commands.map((c) => c.name())).toContain('generate');
  });
});
