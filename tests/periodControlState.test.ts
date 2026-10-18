import { expect, it, vi } from 'vitest';
import { createInitialPeriodValue } from '../src/components/PeriodControl';

it('uses the Jakarta month and year for the default salary target at midnight boundaries', () => {
  expect(createInitialPeriodValue(new Date('2026-12-31T18:00:00Z'))).toMatchObject({
    mode: 'this_month', from: '2027-01-01', to: '2027-01-01', salaryMonth: 1, salaryYear: 2027, valid: true,
  });
});

it('restores a salary target without trusting a saved resolved range', () => {
  vi.stubGlobal('window', { location: { search: '?period=salary_cycle&salary_month=3&salary_year=2026&from=2000-01-01&to=2099-01-01' } });
  try {
    expect(createInitialPeriodValue(new Date('2026-10-17T03:00:00Z'), true)).toMatchObject({
      mode: 'salary_cycle', salaryMonth: 3, salaryYear: 2026, valid: false, from: '2026-10-01', to: '2026-10-17',
    });
  } finally { vi.unstubAllGlobals(); }
});

it('rejects malformed restored custom date ranges', () => {
  vi.stubGlobal('window', { location: { search: '?period=custom&from=2026-02-30&to=2026-03-03' } });
  try { expect(createInitialPeriodValue(new Date('2026-10-17T03:00:00Z'), true).mode).toBe('this_month'); }
  finally { vi.unstubAllGlobals(); }
});
