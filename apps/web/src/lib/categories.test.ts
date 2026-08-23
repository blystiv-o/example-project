import { describe, expect, it } from 'vitest';

import { formatActiveCount, parseBudgetInput, progressValue, usageColor } from './categories';

describe('categories helpers', () => {
  it('formats the active categories counter with the correct Ukrainian grammar', () => {
    expect(formatActiveCount(1)).toBe('1 активна');
    expect(formatActiveCount(2)).toBe('2 активні');
    expect(formatActiveCount(5)).toBe('5 активних');
    expect(formatActiveCount(21)).toBe('21 активна');
  });

  it('parses hryvnia input into kopecks without floating point drift', () => {
    expect(parseBudgetInput('2500')).toBe(250000);
    expect(parseBudgetInput('2500,5')).toBe(250050);
    expect(parseBudgetInput('2500.50')).toBe(250050);
    expect(parseBudgetInput('0.001')).toBeNull();
    expect(parseBudgetInput('-10')).toBeNull();
    expect(parseBudgetInput('1e3')).toBeNull();
  });

  it('derives progress state from the budget usage percent', () => {
    expect(usageColor(79)).toBe('primary');
    expect(usageColor(80)).toBe('warning');
    expect(usageColor(100)).toBe('error');
    expect(progressValue(148)).toBe(100);
  });
});
