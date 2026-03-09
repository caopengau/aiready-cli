import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatCompactNumber,
  formatPercentage,
  formatFileSize,
  formatRelativeTime,
  formatDuration,
  formatMetric,
} from '../formatters';

describe('Formatters', () => {
  it('should format numbers with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('should format compact numbers', () => {
    expect(formatCompactNumber(1234)).toBe('1.2K');
    expect(formatCompactNumber(1234567)).toBe('1.2M');
  });

  it('should format percentages', () => {
    expect(formatPercentage(0.1234)).toBe('12.3%');
    expect(formatPercentage(0.1234, 0)).toBe('12%');
  });

  it('should format file sizes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('should format relative time', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago');
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('should format duration', () => {
    expect(formatDuration(3661000)).toBe('1h 1m 1s');
    expect(formatDuration(61000)).toBe('1m 1s');
    expect(formatDuration(1000)).toBe('1s');
  });

  it('should format metrics based on unit', () => {
    expect(formatMetric(1024, 'bytes')).toBe('1.0 KB');
    expect(formatMetric(0.5, 'percentage')).toBe('50.0%');
    expect(formatMetric(3600000, 'duration')).toBe('1h 0m 0s');
    expect(formatMetric(1200, 'number')).toBe('1.2K');
  });
});
