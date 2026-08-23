import { describe, expect, it } from 'vitest';

import { amountToInput, currentDateInKyiv, formatExpenseDate, parseAmountInput } from './expenses';

describe('expense presentation helpers', () => {
  it.each([
    ['0,01', 1],
    ['12', 1200],
    ['12.5', 1250],
    ['999999999,99', 99_999_999_999],
  ])('parses %s into integer minor units', (input, expected) => {
    expect(parseAmountInput(input)).toBe(expected);
  });

  it.each(['', '1,234', '-1', '12 грн', '1e3'])('rejects invalid amount %s', (input) => {
    expect(parseAmountInput(input)).toBeNull();
  });

  it('formats edit values and calendar dates without a timezone shift', () => {
    expect(amountToInput(1250)).toBe('12,50');
    expect(formatExpenseDate('2026-08-01')).toBe('01.08.2026');
    expect(currentDateInKyiv(new Date('2026-07-31T21:30:00.000Z'))).toBe('2026-08-01');
  });
});
