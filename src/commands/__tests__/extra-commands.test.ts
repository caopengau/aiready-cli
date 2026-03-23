import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  changeAmplificationAction,
  agentGroundingAction,
  aiSignalClarityAction,
  docDriftAction,
  testabilityAction,
  depsHealthAction,
  patternsAction,
  contextAction,
} from '..';

vi.mock('@aiready/core', async () => {
  const actual = await vi.importActual('@aiready/core');
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue({}),
    mergeConfigWithDefaults: vi
      .fn()
      .mockImplementation((c, d) => ({ ...d, ...c })),
    loadMergedConfig: vi.fn().mockResolvedValue({
      rootDir: '/test',
      output: { format: 'console' },
      checkNaming: true,
      checkPatterns: true,
    }),
    handleJSONOutput: vi.fn(),
    handleCLIError: vi.fn(),
    getElapsedTime: vi.fn().mockReturnValue('1.0'),
    resolveOutputPath: vi.fn().mockReturnValue('report.json'),
    formatToolScore: vi.fn().mockReturnValue('Score: 80'),
  };
});

// Mock all spokes
vi.mock('@aiready/change-amplification', () => ({
  analyzeChangeAmplification: vi.fn().mockResolvedValue({
    results: [],
    summary: { rating: 'contained' },
    recommendations: [],
  }),
  calculateChangeAmplificationScore: vi.fn().mockReturnValue({ score: 80 }),
}));
vi.mock('@aiready/agent-grounding', () => ({
  analyzeAgentGrounding: vi.fn().mockResolvedValue({
    results: [],
    summary: {
      rating: 'grounded',
      dimensions: { structure: 80, metadata: 80 },
    },
    recommendations: [],
  }),
  calculateGroundingScore: vi.fn().mockReturnValue({ score: 80 }),
}));
vi.mock('@aiready/ai-signal-clarity', () => ({
  analyzeAiSignalClarity: vi.fn().mockResolvedValue({
    results: [],
    summary: { rating: 'clear', topRisk: 'none' },
    recommendations: [],
  }),
  calculateAiSignalClarityScore: vi.fn().mockReturnValue({ score: 80 }),
}));
vi.mock('@aiready/doc-drift', () => ({
  analyzeDocDrift: vi.fn().mockResolvedValue({
    results: [],
    summary: { rating: 'fresh' },
    issues: [],
    rawData: {},
    recommendations: [],
  }),
  calculateDocDriftScore: vi.fn().mockReturnValue({ score: 80 }),
}));
vi.mock('@aiready/testability', () => ({
  analyzeTestability: vi.fn().mockResolvedValue({
    results: [],
    summary: { rating: 'testable', aiChangeSafetyRating: 'safe' },
    rawData: {},
    recommendations: [],
  }),
  calculateTestabilityScore: vi.fn().mockReturnValue({ score: 80 }),
}));
vi.mock('@aiready/deps', () => ({
  analyzeDeps: vi.fn().mockResolvedValue({
    results: [],
    summary: { packagesAnalyzed: 0, filesAnalyzed: 0, rating: 'healthy' },
    issues: [],
    rawData: {},
    recommendations: [],
  }),
  calculateDepsScore: vi.fn().mockReturnValue({ score: 80 }),
}));
vi.mock('@aiready/pattern-detect', () => ({
  analyzePatterns: vi.fn().mockResolvedValue({
    results: [],
    summary: { totalPatterns: 0 },
    config: {},
  }),
  generateSummary: vi.fn().mockReturnValue({
    totalPatterns: 0,
    totalTokenCost: 0,
    patternsByType: {},
    topDuplicates: [],
  }),
  getSmartDefaults: vi.fn().mockResolvedValue({}),
}));
vi.mock('@aiready/context-analyzer', () => ({
  analyzeContext: vi.fn().mockResolvedValue([]),
  generateSummary: vi.fn().mockReturnValue({
    score: 80,
    rating: 'good',
    totalFiles: 0,
    totalTokens: 0,
    avgImportDepth: 0,
    maxImportDepth: 0,
    avgFragmentation: 0,
    criticalIssues: 0,
    majorIssues: 0,
    totalPotentialSavings: 0,
  }),
  getSmartDefaults: vi.fn().mockResolvedValue({}),
}));

describe('Extra CLI Actions', () => {
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('runs change-amplification', async () => {
    await changeAmplificationAction('.', {});
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('runs agent-grounding', async () => {
    await agentGroundingAction('.', {});
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('runs ai-signal-clarity', async () => {
    await aiSignalClarityAction('.', {});
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('runs doc-drift', async () => {
    await docDriftAction('.', {});
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('runs testability', async () => {
    await testabilityAction('.', {});
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('runs deps-health', async () => {
    await depsHealthAction('.', {});
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('runs patterns', async () => {
    await patternsAction('.', {});
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('runs context', async () => {
    await contextAction('.', {});
    expect(consoleSpy).toHaveBeenCalled();
  });
});
