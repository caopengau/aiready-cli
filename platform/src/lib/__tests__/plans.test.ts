import { describe, it, expect } from 'vitest';
import {
  hasFeature,
  meetsPlanRequirement,
  getUpgradePrompt,
  formatPlanName,
  getPlanPrice,
} from '../plans';

describe('Plan Utilities', () => {
  describe('hasFeature', () => {
    it('should correctly identify features available on Free tier', () => {
      expect(hasFeature('free', 'historicalTrends')).toBe(false);
      expect(hasFeature('free', 'aiRefactoringPlans')).toBe(false);
    });

    it('should correctly identify features available on Pro tier', () => {
      expect(hasFeature('pro', 'historicalTrends')).toBe(true);
      expect(hasFeature('pro', 'aiRefactoringPlans')).toBe(true);
      expect(hasFeature('pro', 'teamBenchmarking')).toBe(false);
    });

    it('should correctly identify features available on Enterprise tier', () => {
      expect(hasFeature('enterprise', 'sso')).toBe(true);
      expect(hasFeature('enterprise', 'apiAccess')).toBe(true);
    });
  });

  describe('meetsPlanRequirement', () => {
    it('should validate plan hierarchy', () => {
      expect(meetsPlanRequirement('pro', 'free')).toBe(true);
      expect(meetsPlanRequirement('pro', 'pro')).toBe(true);
      expect(meetsPlanRequirement('free', 'pro')).toBe(false);
      expect(meetsPlanRequirement('team', 'pro')).toBe(true);
      expect(meetsPlanRequirement('team', 'enterprise')).toBe(false);
    });
  });

  describe('getUpgradePrompt', () => {
    it('should return correct prompt for pro features', () => {
      const prompt = getUpgradePrompt('historicalTrends');
      expect(prompt.requiredPlan).toBe('pro');
      expect(prompt.cta).toBe('Get Pro');
    });

    it('should return correct prompt for enterprise features', () => {
      const prompt = getUpgradePrompt('sso');
      expect(prompt.requiredPlan).toBe('enterprise');
      expect(prompt.cta).toBe('Contact Sales');
    });
  });

  describe('Formatting', () => {
    it('should format plan names', () => {
      expect(formatPlanName('free')).toBe('Free');
      expect(formatPlanName('enterprise')).toBe('Enterprise');
    });

    it('should return correct prices', () => {
      expect(getPlanPrice('free')).toBeNull();
      expect(getPlanPrice('pro')?.monthly).toBe(49);
      expect(getPlanPrice('enterprise')?.annual).toBe(2900);
    });
  });
});
