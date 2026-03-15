import { describe, it, expect } from 'vitest';
import { scoreColor, scoreBg, scoreLabel, getScoreRating } from '../score';

describe('Score Utilities', () => {
  it('should return correct color for scores', () => {
    expect(scoreColor(80)).toBe('text-emerald-400');
    expect(scoreColor(60)).toBe('text-amber-400');
    expect(scoreColor(30)).toBe('text-red-400');
    expect(scoreColor(null)).toBe('text-slate-400');
  });

  it('should return correct background for scores', () => {
    expect(scoreBg(80)).toContain('emerald');
    expect(scoreBg(60)).toContain('amber');
    expect(scoreBg(30)).toContain('red');
    expect(scoreBg(null)).toContain('slate');
  });

  it('should return correct labels', () => {
    expect(scoreLabel(80)).toBe('AI-Ready');
    expect(scoreLabel(60)).toBe('Needs Improvement');
    expect(scoreLabel(30)).toBe('Critical Issues');
    expect(scoreLabel(null)).toBe('Not analyzed');
  });

  it('should return correct rating strings', () => {
    expect(getScoreRating(95)).toBe('excellent');
    expect(getScoreRating(80)).toBe('good');
    expect(getScoreRating(65)).toBe('fair');
    expect(getScoreRating(45)).toBe('needs-work');
    expect(getScoreRating(20)).toBe('critical');
    expect(getScoreRating(null)).toBe('critical');
  });
});
