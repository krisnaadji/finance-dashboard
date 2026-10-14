import { expect, it } from 'vitest';
import { businessDate, shiftCivilDay, calendarMonth, currentMonthRange } from '../src/lib/business-date';
import { todayISO, monthRange, previousDayISO } from '../src/lib/reporting-period';

it('uses Jakarta midnight for report defaults', () => {
  const instant = new Date('2026-12-31T17:00:00Z');
  expect(businessDate(instant)).toBe('2027-01-01');
  expect(todayISO(instant)).toBe('2027-01-01');
  expect(currentMonthRange(instant)).toEqual({ from: '2027-01-01', to: '2027-01-01' });
});
it('preserves calendar and salary civil boundaries', () => {
  expect(shiftCivilDay('2024-03-01', -1)).toBe('2024-02-29');
  expect(previousDayISO('2026-01-01')).toBe('2025-12-31');
  expect(monthRange(2,2026)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  expect(calendarMonth(2026, 13)).toEqual({ from: '2027-01-01', to: '2027-01-31' });
});
it.each(['2026-02-31', '2026-13-01', '2026-2-01', 'garbage'])('refuses invalid civil date %s', day => {
  expect(() => shiftCivilDay(day, -1)).toThrow();
});
