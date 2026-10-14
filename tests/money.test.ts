import { expect, it } from 'vitest';
import { cents, decimal, compareMoney, subtractMoney, formatMoney, budgetPercent } from '../src/lib/money';

it('preserves signed totals above safe integer cents', () => {
  expect(subtractMoney('19999999999999.98','0.01')).toBe('19999999999999.97');
  expect(compareMoney('-0.01','0.00')).toBe(-1);
  expect(compareMoney('19999999999999.97','19999999999999.98')).toBe(-1);
  expect(decimal(cents('-0.01'))).toBe('-0.01');
});
it('formats exact rupiah without rounding or negative zero', () => {
  expect(formatMoney('-1234567.89')).toBe('-1.234.567,89');
  expect(formatMoney('19999999999999.97')).toBe('19.999.999.999.999,97');
  expect(formatMoney('1234.00')).toBe('1.234');
  expect(formatMoney('-0.00')).toBe('0');
});
it('calculates budget percentages from integer ratios', () => {
  expect(budgetPercent('1.00','3.00')).toBe(33.33);
  expect(budgetPercent('4.00','3.00')).toBe(133.33);
  expect(() => budgetPercent('1.00','0.00')).toThrow();
});
it.each(['1.001','1','1e3','NaN','+1.00'])('refuses noncanonical money %s', value => {
  expect(() => cents(value)).toThrow();
});
