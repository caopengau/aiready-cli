'use client';

import { useState, useMemo } from 'react';
import {
  SettingsIcon,
  SaveIcon,
  RefreshCwIcon,
  InfoIcon,
  ShieldIcon,
  TargetIcon,
  ChartIcon,
} from '@/components/Icons';
import type { AIReadyConfig } from '@aiready/core';
import { ToolName } from '@aiready/core/client';
import ConfirmationModal from '@/components/ConfirmationModal';
import { AlertTriangle } from 'lucide-react';

interface Props {
  repoId: string;
  initialSettings: AIReadyConfig | null;
  onSave: (settings: AIReadyConfig | null) => Promise<void>;
  fileCount?: number;
  lastExecutionTime?: number;
  lastSettings?: AIReadyConfig | null;
}

export function ScanConfigForm({
  repoId,
  initialSettings,
  onSave,
  fileCount = 0,
  lastExecutionTime = 0,
  lastSettings = null,
}: Props) {
  const [confirmData, setConfirmData] = useState<{
    type: 'node_modules' | 'approx' | null;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    type: null,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const defaultSettings: AIReadyConfig = useMemo(
    () => ({
      scan: {
        tools: [
          ToolName.PatternDetect,
          ToolName.ContextAnalyzer,
          ToolName.NamingConsistency,
          ToolName.ChangeAmplification,
          ToolName.AiSignalClarity,
          ToolName.AgentGrounding,
          ToolName.TestabilityIndex,
          ToolName.DocDrift,
          ToolName.DependencyHealth,
        ],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      },
      tools: {
        [ToolName.PatternDetect]: {
          minSimilarity: 0.8,
          minLines: 5,
          approx: true,
          minSharedTokens: 10,
          maxCandidatesPerBlock: 100,
        },
        [ToolName.ContextAnalyzer]: {
          maxDepth: 5,
          minCohesion: 0.6,
          maxFragmentation: 0.4,
          includeNodeModules: false,
          focus: 'all',
        },
        [ToolName.NamingConsistency]: {
          disableChecks: [],
        },
        [ToolName.AiSignalClarity]: {
          checkMagicLiterals: true,
          checkBooleanTraps: true,
          checkAmbiguousNames: true,
          checkUndocumentedExports: true,
          checkImplicitSideEffects: true,
          checkDeepCallbacks: true,
        },
        [ToolName.AgentGrounding]: { maxRecommendedDepth: 4 },
        [ToolName.TestabilityIndex]: { minCoverageRatio: 0.5 },
        [ToolName.DocDrift]: { staleMonths: 6 },
        [ToolName.DependencyHealth]: { trainingCutoffYear: 2024 },
      },
      scoring: {
        threshold: 70,
      },
    }),
    []
  );

  const mergedInitialSettings = useMemo<AIReadyConfig>(() => {
    if (!initialSettings) return defaultSettings;

    // Map aliases to canonical names in initialSettings
    const aliasMap: Record<string, string> = {
      patterns: ToolName.PatternDetect,
      duplicates: ToolName.PatternDetect,
      context: ToolName.ContextAnalyzer,
      fragmentation: ToolName.ContextAnalyzer,
      consistency: ToolName.NamingConsistency,
      'ai-signal': ToolName.AiSignalClarity,
      grounding: ToolName.AgentGrounding,
      testability: ToolName.TestabilityIndex,
      'deps-health': ToolName.DependencyHealth,
      'change-amp': ToolName.ChangeAmplification,
    };

    const normalizedTools = (initialSettings.scan?.tools || []).map(
      (t) => aliasMap[t] || t
    );

    return {
      ...defaultSettings,
      ...initialSettings,
      scan: {
        ...defaultSettings.scan,
        ...initialSettings.scan,
        tools:
          normalizedTools.length > 0
            ? normalizedTools
            : defaultSettings.scan!.tools,
      },
      tools: {
        ...defaultSettings.tools,
        ...initialSettings.tools,
      },
      scoring: {
        ...defaultSettings.scoring,
        ...initialSettings.scoring,
      },
    };
  }, [initialSettings, defaultSettings]);

  const [settings, setSettings] = useState<AIReadyConfig>(
    mergedInitialSettings
  );

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(mergedInitialSettings);
  }, [settings, mergedInitialSettings]);

  const estimatedTime = useMemo(() => {
    if (fileCount === 0) return null;

    // 1. Calculate base estimate using heuristics
    const calculateHeuristic = (cfg: AIReadyConfig | null) => {
      if (!cfg) return 60;

      // Use a floor for estimation to show meaningful changes even on small repos
      const estFileCount = Math.max(fileCount, 100);

      let seconds = 35; // Base overhead (provisioning, cloning, setup)
      const activeTools = cfg.scan?.tools || [];

      // Core file scanning & parsing (0.1s per file)
      seconds += estFileCount * 0.1;

      // Pattern Detection (The most expensive O(N^2) tool)
      if (
        activeTools.includes(ToolName.PatternDetect) ||
        activeTools.includes('patterns')
      ) {
        const toolCfg =
          cfg.tools?.[ToolName.PatternDetect] ||
          (cfg.tools as any)?.['patterns'];
        const minLines = toolCfg?.minLines || 5;
        const minSimilarity = toolCfg?.minSimilarity || 0.8;
        const approx = toolCfg?.approx !== false;
        const minTokens = toolCfg?.minSharedTokens || 10;
        const maxCandidates = toolCfg?.maxCandidatesPerBlock || 100;

        // minLines impact: number of blocks scales inversely with minLines
        const blocksPerFile = 7 * (5 / minLines);
        const blocks = estFileCount * blocksPerFile;
        const totalComparisons = (blocks * blocks) / 2;

        if (approx) {
          // Candidate selection cost
          seconds += blocks * 0.005;

          // Verification cost (Highly sensitive to minTokens and maxCandidates)
          const tokenFactor = 2.0 - minTokens / 10; // More tokens = less work
          const verificationWork = blocks * maxCandidates * tokenFactor;
          seconds += verificationWork / 10000;
        } else {
          // Exhaustive mode (Very expensive)
          const pruningFactor = 1.2 - minSimilarity; // Higher similarity = faster pruning
          const comparisonWork = totalComparisons * pruningFactor;

          // maxCandidates dramatically increases verification depth
          const workFactor = 1 + maxCandidates / 10;
          seconds += (comparisonWork * workFactor) / 18000;
        }
      }

      // Context Analyzer
      if (
        activeTools.includes(ToolName.ContextAnalyzer) ||
        activeTools.includes('context')
      ) {
        const toolCfg =
          cfg.tools?.[ToolName.ContextAnalyzer] ||
          (cfg.tools as any)?.['context'];
        const depth = toolCfg?.maxDepth || 5;
        seconds += estFileCount * 0.2 * Math.pow(1.6, depth - 5);
      }

      // Other tools
      const otherToolsCount = activeTools.filter(
        (t) =>
          t !== ToolName.PatternDetect &&
          t !== 'patterns' &&
          t !== ToolName.ContextAnalyzer &&
          t !== 'context'
      ).length;
      seconds += estFileCount * 0.04 * otherToolsCount;

      // Post-processing (Normalization, DB updates, Score calculation)
      // Log showed this taking ~30-35s for 444 files
      seconds += 25 + estFileCount * 0.03;

      return seconds;
    };

    const currentHeuristic = calculateHeuristic(settings);

    // 2. Refine using historical data if available
    if (lastExecutionTime > 0 && lastSettings) {
      const historicalHeuristic = calculateHeuristic(lastSettings);
      const lastSeconds = lastExecutionTime / 1000;

      // Correction factor: how much faster or slower the real repo is compared to heuristic
      const correctionFactor = Math.min(
        Math.max(lastSeconds / historicalHeuristic, 0.2),
        5.0
      );

      return Math.round(currentHeuristic * correctionFactor);
    }

    return Math.round(currentHeuristic);
  }, [settings, fileCount, lastExecutionTime, lastSettings]);

  const timeWarning = estimatedTime && estimatedTime > 600; // > 10 minutes

  const handleToggleTool = (tool: string) => {
    const tools = settings.scan?.tools || [];
    const newTools = tools.includes(tool)
      ? tools.filter((t) => t !== tool)
      : [...tools, tool];

    setSettings({
      ...settings,
      scan: { ...settings.scan, tools: newTools },
    });
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      await onSave(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset to smart defaults?')) {
      await onSave(null);
      window.location.reload();
    }
  };

  const allTools = [
    {
      id: ToolName.PatternDetect,
      name: 'Pattern Detection',
      description: 'Finds semantic duplicates and logic clones.',
    },
    {
      id: ToolName.ContextAnalyzer,
      name: 'Context Analyzer',
      description: 'Analyzes dependency fragmentation and context costs.',
    },
    {
      id: ToolName.NamingConsistency,
      name: 'Naming Consistency',
      description: 'Enforces standard naming conventions and clarity.',
    },
    {
      id: ToolName.ChangeAmplification,
      name: 'Change Amplification',
      description: 'Detects code that causes excessive downstream changes.',
    },
    {
      id: ToolName.AiSignalClarity,
      name: 'AI Signal Clarity',
      description: 'Measures how easy it is for AI to reason about the code.',
    },
    {
      id: ToolName.AgentGrounding,
      name: 'Agent Grounding',
      description: 'Verifies if business concepts are correctly implemented.',
    },
    {
      id: ToolName.TestabilityIndex,
      name: 'Testability Index',
      description: 'Evaluates how easy it is to write unit tests for the code.',
    },
    {
      id: ToolName.DocDrift,
      name: 'Document Drift',
      description: 'Checks if documentation matches actual implementation.',
    },
    {
      id: ToolName.DependencyHealth,
      name: 'Dependency Health',
      description: 'Analyzes external dependency risks and bloat.',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="glass-card rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
              <SettingsIcon className="w-5 h-5 text-cyan-500" />
            </div>
            <h2 className="text-xl font-bold">Scan Scope</h2>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors text-xs font-bold uppercase tracking-wider"
          >
            <RefreshCwIcon className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>
        </div>

        <div className="space-y-4">
          <div className="group relative">
            <label className="block text-sm font-bold text-slate-400 mb-2 flex items-center gap-2">
              Excluded Patterns (Glob)
              <div className="group relative">
                <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                  <p className="font-bold text-cyan-400 mb-1">
                    Scope Optimization
                  </p>
                  Exclude tests, build artifacts, or vendor code to save context
                  window and focus analysis on core business logic.
                </div>
              </div>
            </label>
            <textarea
              value={settings.scan?.exclude?.join(', ') || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  scan: {
                    ...settings.scan,
                    exclude: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              placeholder="**/node_modules/**, **/dist/**"
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-slate-300 focus:outline-none focus:border-cyan-500/50 transition-colors min-h-[100px] font-mono text-sm"
            />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <ShieldIcon className="w-5 h-5 text-purple-500" />
          </div>
          <h2 className="text-xl font-bold">Standard Uplifting Spokes</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allTools.map((tool) => (
            <div
              key={tool.id}
              onClick={() => handleToggleTool(tool.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                settings.scan?.tools?.includes(tool.id)
                  ? 'bg-cyan-500/5 border-cyan-500/30'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{tool.name}</span>
                <div
                  className={`w-4 h-4 rounded-full border ${
                    settings.scan?.tools?.includes(tool.id)
                      ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                      : 'border-slate-700'
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-tight">
                {tool.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <TargetIcon className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold">Fine-Tuning Thresholds</h2>
        </div>

        <div className="space-y-12">
          {/* Pattern Detection */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
              Pattern Detection
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Min Similarity
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        <p className="font-bold text-amber-400 mb-1">
                          Cloning Strictness
                        </p>
                        Lower values find more subtle duplicates. Higher values
                        focus on near-identical "copy-paste" code clones.
                      </div>
                    </div>
                  </span>
                  <span className="text-amber-500">
                    {Math.round(
                      (settings.tools?.[ToolName.PatternDetect]
                        ?.minSimilarity || 0.8) * 100
                    )}
                    %
                  </span>
                </label>
                <input
                  type="range"
                  min="0.4"
                  max="1.0"
                  step="0.05"
                  value={
                    settings.tools?.[ToolName.PatternDetect]?.minSimilarity ||
                    0.8
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.PatternDetect]: {
                          ...settings.tools?.[ToolName.PatternDetect],
                          minSimilarity: parseFloat(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Min Lines
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        <p className="font-bold text-amber-400 mb-1">
                          Noise Filtering
                        </p>
                        Minimum length of a code block to be considered for
                        duplication. Increase this to ignore boilerplate
                        snippets.
                      </div>
                    </div>
                  </span>
                  <span className="text-amber-500">
                    {settings.tools?.[ToolName.PatternDetect]?.minLines || 5}{' '}
                    lines
                  </span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="50"
                  step="1"
                  value={
                    settings.tools?.[ToolName.PatternDetect]?.minLines || 5
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.PatternDetect]: {
                          ...settings.tools?.[ToolName.PatternDetect],
                          minLines: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/50">
              <div
                onClick={() => {
                  const current =
                    settings.tools?.[ToolName.PatternDetect]?.approx !== false;
                  const newVal = !current;

                  if (!newVal) {
                    // Disabling is the risky action here (performance penalty)
                    setConfirmData({
                      type: 'approx',
                      title: 'Disable Approximate Matching?',
                      message:
                        'WARNING: Disabling approximate matching forces an exact $O(N^2)$ comparison across all code blocks. This will significantly increase scan time and may cause timeouts on larger repositories.',
                      onConfirm: () => {
                        setSettings({
                          ...settings,
                          tools: {
                            ...settings.tools,
                            [ToolName.PatternDetect]: {
                              ...settings.tools?.[ToolName.PatternDetect],
                              approx: false,
                            },
                          },
                        });
                        setConfirmData((prev) => ({ ...prev, type: null }));
                      },
                    });
                  } else {
                    // Enabling is the recommended/fast path
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.PatternDetect]: {
                          ...settings.tools?.[ToolName.PatternDetect],
                          approx: true,
                        },
                      },
                    });
                  }
                }}
                className={`group relative p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  settings.tools?.[ToolName.PatternDetect]?.approx !== false
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'
                    : 'bg-red-500/10 border-red-500/30 text-red-500'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase flex items-center gap-2">
                    Approximate Match
                    {settings.tools?.[ToolName.PatternDetect]?.approx ===
                      false && (
                      <span className="bg-red-500 text-[8px] px-1.5 py-0.5 rounded text-white">
                        SLOW
                      </span>
                    )}
                  </span>
                </div>
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    settings.tools?.[ToolName.PatternDetect]?.approx !== false
                      ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                      : 'bg-red-500'
                  }`}
                />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-400 z-50 shadow-2xl normal-case">
                  {settings.tools?.[ToolName.PatternDetect]?.approx !== false
                    ? 'Uses optimized candidate selection for faster scans. (Recommended)'
                    : 'Forces exhaustive pairwise comparison. Significantly slower.'}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  Min Tokens
                  <div className="group relative">
                    <InfoIcon className="w-3 h-3 text-slate-700 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-400 z-50 shadow-2xl normal-case">
                      Minimum number of shared structural tokens. Increase for
                      fewer but higher-confidence matches.
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  value={
                    settings.tools?.[ToolName.PatternDetect]?.minSharedTokens ||
                    10
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.PatternDetect]: {
                          ...settings.tools?.[ToolName.PatternDetect],
                          minSharedTokens: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-2 text-xs text-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  Max Candidates
                  <div className="group relative">
                    <InfoIcon className="w-3 h-3 text-slate-700 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-400 z-50 shadow-2xl normal-case">
                      Limits the number of duplication comparisons per block.
                      Lower values speed up scans on massive repos.
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  value={
                    settings.tools?.[ToolName.PatternDetect]
                      ?.maxCandidatesPerBlock || 100
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.PatternDetect]: {
                          ...settings.tools?.[ToolName.PatternDetect],
                          maxCandidatesPerBlock: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-2 text-xs text-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Context Analyzer */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
              Context & Architecture
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Max Context Depth
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        <p className="font-bold text-cyan-400 mb-1">
                          Dependency Horizon
                        </p>
                        How deep to follow import chains. Higher depth captures
                        transitive complexity but increases context consumption.
                      </div>
                    </div>
                  </span>
                  <span className="text-amber-500">
                    {settings.tools?.[ToolName.ContextAnalyzer]?.maxDepth || 5}{' '}
                    layers
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={
                    settings.tools?.[ToolName.ContextAnalyzer]?.maxDepth || 5
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.ContextAnalyzer]: {
                          ...settings.tools?.[ToolName.ContextAnalyzer],
                          maxDepth: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Min Cohesion Score
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        <p className="font-bold text-cyan-400 mb-1">
                          Architectural Health
                        </p>
                        Files below this target score are flagged as "God
                        Objects" or fragmented logic needing modularization.
                      </div>
                    </div>
                  </span>
                  <span className="text-amber-500">
                    {Math.round(
                      (settings.tools?.[ToolName.ContextAnalyzer]
                        ?.minCohesion || 0.6) * 100
                    )}
                    %
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={
                    settings.tools?.[ToolName.ContextAnalyzer]?.minCohesion ||
                    0.6
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.ContextAnalyzer]: {
                          ...settings.tools?.[ToolName.ContextAnalyzer],
                          minCohesion: parseFloat(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-800/50">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Max Fragmentation
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        Threshold for logic dispersion. Higher values allow
                        functionality to be more spread across the codebase
                        before flagging.
                      </div>
                    </div>
                  </span>
                  <span className="text-amber-500">
                    {Math.round(
                      (settings.tools?.[ToolName.ContextAnalyzer]
                        ?.maxFragmentation || 0.4) * 100
                    )}
                    %
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={
                    settings.tools?.[ToolName.ContextAnalyzer]
                      ?.maxFragmentation || 0.4
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.ContextAnalyzer]: {
                          ...settings.tools?.[ToolName.ContextAnalyzer],
                          maxFragmentation: parseFloat(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="flex flex-col justify-end gap-4">
                <div className="group relative p-3 rounded-xl border bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed flex items-center justify-between opacity-60">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase flex items-center gap-2">
                      Scan Node Modules
                      <span className="bg-slate-800 text-[8px] px-1.5 py-0.5 rounded text-slate-500 border border-slate-700">
                        LOCKED
                      </span>
                    </span>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-400 z-50 shadow-2xl normal-case">
                    Scanning 3rd party source code is disabled to prevent
                    excessive context window consumption and system timeouts.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                    Analysis Focus:
                  </span>
                  <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 w-full">
                    {[
                      { id: 'all', label: 'all' },
                      { id: 'cohesion', label: 'cohesion' },
                      { id: 'fragmentation', label: 'fragment' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() =>
                          setSettings({
                            ...settings,
                            tools: {
                              ...settings.tools,
                              [ToolName.ContextAnalyzer]: {
                                ...settings.tools?.[ToolName.ContextAnalyzer],
                                focus: f.id as any,
                              },
                            },
                          })
                        }
                        className={`flex-1 text-[9px] uppercase font-bold py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1 ${
                          (settings.tools?.[ToolName.ContextAnalyzer]?.focus ||
                            'all') === f.id
                            ? 'bg-slate-700 text-cyan-400'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {f.label}
                        {f.id === 'all' && (
                          <span className="text-[7px] opacity-50 underline decoration-cyan-500/50">
                            (Rec)
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Signal Clarity */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
              AI Signal Clarity
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'checkMagicLiterals',
                  label: 'Magic Literals',
                  tip: 'Detects hardcoded values that lack semantic context for AI models.',
                },
                {
                  id: 'checkBooleanTraps',
                  label: 'Boolean Traps',
                  tip: 'Identifies positional booleans that are ambiguous without parameter names.',
                },
                {
                  id: 'checkAmbiguousNames',
                  label: 'Ambiguous Names',
                  tip: 'Flags variables like "data" or "item" that provide no reasoning signal.',
                },
                {
                  id: 'checkUndocumentedExports',
                  label: 'Undocumented Exports',
                  tip: 'Ensures public APIs have JSDoc/Docstrings for agent grounding.',
                },
                {
                  id: 'checkImplicitSideEffects',
                  label: 'Side Effects',
                  tip: 'Detects functions that modify global state, confusing agentic logic.',
                },
                {
                  id: 'checkDeepCallbacks',
                  label: 'Deep Callbacks',
                  tip: 'Flags nested callbacks that create complex reasoning paths for LLMs.',
                },
              ].map((check) => (
                <div
                  key={check.id}
                  onClick={() => {
                    const current =
                      (settings.tools?.[ToolName.AiSignalClarity] as any)?.[
                        check.id
                      ] !== false;
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.AiSignalClarity]: {
                          ...settings.tools?.[ToolName.AiSignalClarity],
                          [check.id]: !current,
                        },
                      },
                    });
                  }}
                  className={`group relative p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    (settings.tools?.[ToolName.AiSignalClarity] as any)?.[
                      check.id
                    ] !== false
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase">
                    {check.label}
                  </span>
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      (settings.tools?.[ToolName.AiSignalClarity] as any)?.[
                        check.id
                      ] !== false
                        ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                        : 'bg-slate-800'
                    }`}
                  />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-400 z-50 shadow-2xl normal-case">
                    {check.tip}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Grounding & Documentation */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
              Agent Grounding & Docs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Max Recommended Depth
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        <p className="font-bold text-amber-400 mb-1">
                          Reasoning Complexity
                        </p>
                        Deeply nested logic is significantly harder for AI
                        agents to reason about accurately. Targets flatter
                        architectures.
                      </div>
                    </div>
                  </span>
                  <span className="text-amber-500">
                    {settings.tools?.[ToolName.AgentGrounding]
                      ?.maxRecommendedDepth || 4}{' '}
                    levels
                  </span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                  value={
                    settings.tools?.[ToolName.AgentGrounding]
                      ?.maxRecommendedDepth || 4
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.AgentGrounding]: {
                          ...settings.tools?.[ToolName.AgentGrounding],
                          maxRecommendedDepth: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Doc Drift Stale Months
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        <p className="font-bold text-amber-400 mb-1">
                          Information Freshness
                        </p>
                        Documentation older than this threshold is compared
                        against recent code changes to detect hallucination
                        risks.
                      </div>
                    </div>
                  </span>
                  <span className="text-amber-500">
                    {settings.tools?.[ToolName.DocDrift]?.staleMonths || 6}{' '}
                    months
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="24"
                  step="1"
                  value={settings.tools?.[ToolName.DocDrift]?.staleMonths || 6}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.DocDrift]: {
                          ...settings.tools?.[ToolName.DocDrift],
                          staleMonths: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Naming Consistency & Standards */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
              Naming & Consistency
            </h3>
            <div className="space-y-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                Disable Specific Checks
                <div className="group relative">
                  <InfoIcon className="w-3 h-3 text-slate-700 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl normal-case">
                    Turn off specific naming rules if your project has a unique
                    style or many legacy abbreviations.
                  </div>
                </div>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  'single-letter',
                  'abbreviation',
                  'convention-mix',
                  'unclear',
                ].map((check) => (
                  <div
                    key={check}
                    onClick={() => {
                      const disabled =
                        (settings.tools?.[ToolName.NamingConsistency] as any)
                          ?.disableChecks || [];
                      const newDisabled = disabled.includes(check)
                        ? disabled.filter((c: string) => c !== check)
                        : [...disabled, check];
                      setSettings({
                        ...settings,
                        tools: {
                          ...settings.tools,
                          [ToolName.NamingConsistency]: {
                            ...settings.tools?.[ToolName.NamingConsistency],
                            disableChecks: newDisabled,
                          },
                        },
                      });
                    }}
                    className={`p-2 rounded-lg border text-[10px] font-bold uppercase text-center cursor-pointer transition-all ${
                      (
                        (settings.tools?.[ToolName.NamingConsistency] as any)
                          ?.disableChecks || []
                      ).includes(check)
                        ? 'bg-slate-800 border-slate-700 text-slate-500 line-through'
                        : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                    }`}
                  >
                    {check}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Testability & Dependencies */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
              Tests & Dependencies
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Min Coverage Ratio
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        Target ratio of source files to test files. Higher
                        values enforce stricter verification standards.
                      </div>
                    </div>
                  </span>
                  <span className="text-amber-500">
                    {Math.round(
                      (settings.tools?.[ToolName.TestabilityIndex]
                        ?.minCoverageRatio || 0.5) * 100
                    )}
                    %
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={
                    settings.tools?.[ToolName.TestabilityIndex]
                      ?.minCoverageRatio || 0.5
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.TestabilityIndex]: {
                          ...settings.tools?.[ToolName.TestabilityIndex],
                          minCoverageRatio: parseFloat(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Package Cutoff Year
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        Flags dependencies that haven't been updated since this
                        year as "stale" or "high risk".
                      </div>
                    </div>
                  </span>
                  <span className="text-amber-500">
                    {settings.tools?.[ToolName.DependencyHealth]
                      ?.trainingCutoffYear || 2024}
                  </span>
                </label>
                <input
                  type="range"
                  min="2015"
                  max={new Date().getFullYear()}
                  step="1"
                  value={
                    settings.tools?.[ToolName.DependencyHealth]
                      ?.trainingCutoffYear || 2024
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tools: {
                        ...settings.tools,
                        [ToolName.DependencyHealth]: {
                          ...settings.tools?.[ToolName.DependencyHealth],
                          trainingCutoffYear: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Global Scoring Section */}
          <div className="pt-8 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-500/10 rounded-xl border border-green-500/20">
                <ChartIcon className="w-5 h-5 text-green-500" />
              </div>
              <h2 className="text-xl font-bold">Global Quality Gate</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Pass/Fail Threshold
                    <div className="group relative">
                      <InfoIcon className="w-4 h-4 text-slate-600 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 z-50 shadow-2xl">
                        Minimum overall AI-Readiness score required to pass CI
                        checks and PR status gates.
                      </div>
                    </div>
                  </span>
                  <span className="text-green-500 font-mono text-lg">
                    {settings.scoring?.threshold || 70}
                  </span>
                </label>
                <input
                  type="range"
                  min="30"
                  max="95"
                  step="5"
                  value={settings.scoring?.threshold || 70}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scoring: {
                        ...settings.scoring,
                        threshold: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-green-500"
                />
              </div>
              <div className="flex items-center justify-center p-6 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                <p className="text-[10px] text-slate-500 text-center uppercase leading-loose tracking-widest">
                  Adjusting these parameters changes the strictness of your{' '}
                  <span className="text-cyan-500">AIReady Score</span>. <br />
                  Lower thresholds reduce noise; higher thresholds uplift
                  standards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 pb-10">
        {estimatedTime !== null && (
          <div
            className={`p-6 rounded-3xl border transition-all ${
              timeWarning
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-slate-900/50 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl border ${
                    timeWarning
                      ? 'bg-red-500/20 border-red-500/30 text-red-500'
                      : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500'
                  }`}
                >
                  <RefreshCwIcon
                    className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`}
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-widest">
                    Estimated Scan Time
                  </h4>
                  <p className="text-[10px] text-slate-500 uppercase">
                    Based on {fileCount} files and selected strategy
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-2xl font-black font-mono ${
                    timeWarning ? 'text-red-500' : 'text-cyan-500'
                  }`}
                >
                  {Math.floor(estimatedTime / 60)}:
                  {(estimatedTime % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] block text-slate-500 font-bold uppercase">
                  Minutes
                </span>
              </div>
            </div>

            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full transition-all duration-500 ${
                  timeWarning ? 'bg-red-500' : 'bg-cyan-500'
                }`}
                style={{
                  width: `${Math.min(100, (estimatedTime / 900) * 100)}%`,
                }}
              />
            </div>

            {timeWarning ? (
              <div className="flex items-start gap-3 p-3 bg-red-500/20 rounded-xl border border-red-500/30 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-200 leading-relaxed">
                  <span className="font-bold block mb-1">TIMEOUT RISK</span>
                  This configuration might exceed the 15-minute system limit.
                  Consider enabling{' '}
                  <span className="font-bold">Approximate Matching</span> or
                  reducing <span className="font-bold">Context Depth</span> to
                  speed up the scan.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Scan time is estimated and may vary based on file complexity and
                system load. A 10-minute safe buffer is recommended.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-slate-500 text-xs">
            <ChartIcon className="w-4 h-4" />
            <p>
              {hasChanges
                ? 'You have unsaved changes to your scan strategy.'
                : 'These settings will be applied to the next scan of this repository.'}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all shadow-xl ${
              success
                ? 'bg-green-500 text-white shadow-green-500/20'
                : !hasChanges
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/20 active:scale-95'
            } disabled:opacity-50`}
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : success ? (
              <>
                <RefreshCwIcon className="w-5 h-5" />
                Settings Updated
              </>
            ) : (
              <>
                <SaveIcon className="w-5 h-5" />
                Save Strategy
              </>
            )}
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmData.type !== null}
        onClose={() => setConfirmData((prev) => ({ ...prev, type: null }))}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        message={confirmData.message}
        variant="warning"
        confirmText="Enable Anyway"
      />
    </div>
  );
}
