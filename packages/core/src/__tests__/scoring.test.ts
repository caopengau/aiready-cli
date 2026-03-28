import { describe, it, expect } from 'vitest';
import {
  calculateOverallScore,
  getRating,
  parseWeightString,
  normalizeToolName,
  getToolWeight,
  getProjectSizeTier,
  getRecommendedThreshold,
  getRatingWithContext,
  getRatingDisplay,
  formatScore,
  formatToolScore,
  DEFAULT_TOOL_WEIGHTS,
  ScoringProfile,
  type ToolScoringOutput,
} from '../scoring';

describe('Core Scoring Infrastructure', () => {
  describe('calculateOverallScore', () => {
    it('should calculate weighted average correctly', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>([
        [
          'pattern-detect',
          {
            toolName: 'pattern-detect',
            score: 80,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
        [
          'context-analyzer',
          {
            toolName: 'context-analyzer',
            score: 60,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
      ]);

      // Default weights: pattern-detect=22, context-analyzer=19
      // (80 * 22 + 60 * 19) / (22 + 19) = (1760 + 1140) / 41 = 2900 / 41 = 70.73 → 71
      const result = calculateOverallScore(toolOutputs);

      expect(result.overall).toBe(71);
      expect(result.rating).toBe('Fair'); // 71 is in Fair range (60-74)
      expect(result.toolsUsed).toEqual(['pattern-detect', 'context-analyzer']);
      expect(result.breakdown).toHaveLength(2);
    });

    it('should apply CLI weight overrides', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>([
        [
          'pattern-detect',
          {
            toolName: 'pattern-detect',
            score: 80,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
        [
          'context-analyzer',
          {
            toolName: 'context-analyzer',
            score: 60,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
      ]);

      const cliWeights = new Map([
        ['pattern-detect', 50],
        ['context-analyzer', 50],
      ]);

      // Equal weights: (80 * 50 + 60 * 50) / 100 = 7000 / 100 = 70
      const result = calculateOverallScore(toolOutputs, undefined, cliWeights);

      expect(result.overall).toBe(70);
      expect(result.calculation.weights['pattern-detect']).toBe(50);
      expect(result.calculation.weights['context-analyzer']).toBe(50);
    });

    it('should handle single tool scoring', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>([
        [
          'pattern-detect',
          {
            toolName: 'pattern-detect',
            score: 85,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
      ]);

      const result = calculateOverallScore(toolOutputs);

      expect(result.overall).toBe(85);
      expect(result.toolsUsed).toEqual(['pattern-detect']);
    });

    it('should apply config weights when no CLI override', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>([
        [
          'pattern-detect',
          {
            toolName: 'pattern-detect',
            score: 90,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
      ]);

      const config = {
        tools: {
          'pattern-detect': {
            scoreWeight: 60,
          },
        },
      };

      const result = calculateOverallScore(toolOutputs, config);

      expect(result.overall).toBe(90);
      expect(result.calculation.weights['pattern-detect']).toBe(60);
    });

    it('should throw error when no tool outputs provided', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>();

      expect(() => calculateOverallScore(toolOutputs)).toThrow(
        'No tool outputs provided for scoring'
      );
    });

    it('should respect scoring profiles', () => {
      const toolOutputs = new Map<string, ToolScoringOutput>([
        [
          'ai-signal-clarity',
          {
            toolName: 'ai-signal-clarity',
            score: 100,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
        [
          'agent-grounding',
          {
            toolName: 'agent-grounding',
            score: 50,
            rawMetrics: {},
            factors: [],
            recommendations: [],
          },
        ],
      ]);

      const config = { profile: ScoringProfile.Agentic };

      // Agentic weights: ai-signal-clarity=25, agent-grounding=25
      // (100 * 25 + 50 * 25) / 50 = (2500 + 1250) / 50 = 3750 / 50 = 75
      const result = calculateOverallScore(toolOutputs, config);

      expect(result.overall).toBe(75);
      expect(result.calculation.weights['ai-signal-clarity']).toBe(25);
      expect(result.calculation.weights['agent-grounding']).toBe(25);
    });
  });

  describe('getRating', () => {
    it('should return correct ratings for score ranges', () => {
      expect(getRating(100)).toBe('Excellent');
      expect(getRating(90)).toBe('Excellent');
      expect(getRating(89)).toBe('Good');
      expect(getRating(75)).toBe('Good');
      expect(getRating(74)).toBe('Fair');
      expect(getRating(60)).toBe('Fair');
      expect(getRating(59)).toBe('Needs Work');
      expect(getRating(40)).toBe('Needs Work');
      expect(getRating(39)).toBe('Critical');
      expect(getRating(0)).toBe('Critical');
    });
  });

  describe('parseWeightString', () => {
    it('should parse valid weight string', () => {
      const weights = parseWeightString(
        'patterns:50,context:30,consistency:20'
      );

      expect(weights.get('pattern-detect')).toBe(50);
      expect(weights.get('context-analyzer')).toBe(30);
      expect(weights.get('naming-consistency')).toBe(20);
    });

    it('should return empty map for undefined input', () => {
      const weights = parseWeightString(undefined);

      expect(weights.size).toBe(0);
    });

    it('should skip invalid pairs', () => {
      const weights = parseWeightString(
        'patterns:50,invalid,context:abc,consistency:30'
      );

      expect(weights.get('pattern-detect')).toBe(50);
      expect(weights.get('context-analyzer')).toBeUndefined();
      expect(weights.get('naming-consistency')).toBe(30);
    });
  });

  describe('normalizeToolName', () => {
    it('should normalize shorthand tool names', () => {
      expect(normalizeToolName('patterns')).toBe('pattern-detect');
      expect(normalizeToolName('context')).toBe('context-analyzer');
      expect(normalizeToolName('consistency')).toBe('naming-consistency');
    });

    it('should return full names unchanged', () => {
      expect(normalizeToolName('pattern-detect')).toBe('pattern-detect');
      expect(normalizeToolName('context-analyzer')).toBe('context-analyzer');
    });

    it('should return unknown names unchanged', () => {
      expect(normalizeToolName('unknown-tool')).toBe('unknown-tool');
    });
  });

  describe('getToolWeight', () => {
    it('should prioritize CLI override', () => {
      const weight = getToolWeight('pattern-detect', { scoreWeight: 30 }, 50);

      expect(weight).toBe(50);
    });

    it('should use config weight when no CLI override', () => {
      const weight = getToolWeight(
        'pattern-detect',
        { scoreWeight: 30 },
        undefined
      );

      expect(weight).toBe(30);
    });

    it('should fall back to default weight', () => {
      const weight = getToolWeight('pattern-detect', undefined, undefined);

      expect(weight).toBe(DEFAULT_TOOL_WEIGHTS['pattern-detect']);
    });

    it('should use 5 for unknown tools', () => {
      const weight = getToolWeight('unknown-tool', undefined, undefined);

      expect(weight).toBe(5);
    });
  });

  describe('Project Size and Thresholds', () => {
    it('should determine correct project size tier', () => {
      expect(getProjectSizeTier(10)).toBe('xs');
      expect(getProjectSizeTier(100)).toBe('small');
      expect(getProjectSizeTier(300)).toBe('medium');
      expect(getProjectSizeTier(1000)).toBe('large');
      expect(getProjectSizeTier(5000)).toBe('enterprise');
    });

    it('should calculate recommended threshold based on size and tier', () => {
      expect(getRecommendedThreshold(10, 'standard')).toBe(80);
      expect(getRecommendedThreshold(100, 'standard')).toBe(75);
      expect(getRecommendedThreshold(5000, 'standard')).toBe(58);

      // Model bonuses
      expect(getRecommendedThreshold(100, 'extended')).toBe(73); // 75 - 2
      expect(getRecommendedThreshold(100, 'frontier')).toBe(72); // 75 - 3
    });

    it('should provide size-aware ratings', () => {
      // Small project (80 threshold): 85 is Excellent?
      // Rating with context: score - threshold + 70
      // 85 - 80 + 70 = 75 -> Good
      expect(getRatingWithContext(85, 10, 'standard')).toBe('Good');

      // Large project (58 threshold): 65
      // 65 - 58 + 70 = 77 -> Good
      expect(getRatingWithContext(65, 5000, 'standard')).toBe('Good');
    });
  });

  describe('Formatting and Display', () => {
    it('should get correct display properties for ratings', () => {
      expect(getRatingDisplay('Excellent')).toEqual({
        emoji: '✅',
        color: 'green',
      });
      expect(getRatingDisplay('Critical')).toEqual({
        emoji: '❌',
        color: 'red',
      });
      expect(getRatingDisplay('Unknown')).toEqual({
        emoji: '❓',
        color: 'gray',
      });
    });

    it('should format overall score correctly', () => {
      const result: any = { overall: 85, rating: 'Good' };
      expect(formatScore(result)).toBe('85/100 (Good) 👍');
    });

    it('should format tool score with factors and recommendations', () => {
      const output: ToolScoringOutput = {
        toolName: 'test-tool',
        score: 70,
        rawMetrics: {},
        factors: [
          { name: 'Test Factor', impact: -5, description: 'Negative impact' },
        ],
        recommendations: [
          { action: 'Fix this', priority: 'high', estimatedImpact: 10 },
        ],
      };

      const formatted = formatToolScore(output);
      expect(formatted).toContain('Score: 70/100');
      expect(formatted).toContain('Test Factor: -5');
      expect(formatted).toContain('🔴 Fix this');
      expect(formatted).toContain('Impact: +10 points');
    });
  });
});
