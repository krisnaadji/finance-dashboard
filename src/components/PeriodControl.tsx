'use client';

import { currentMonthRange } from '@/lib/reporting-period';
import { isBusinessDate } from '@/lib/financial-validation';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type PeriodMode = 'this_month' | 'salary_cycle' | 'custom';

export interface PeriodValue {
  mode: PeriodMode;
  from: string;
  to: string;
  salaryMonth: number;
  salaryYear: number;
  valid: boolean;
  resolvedAccountId?: string;
}

export interface PeriodControlProps {
  accountId: string;
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  className?: string;
}

type PeriodApiResponse =
  | {
      ok: true;
      from: string;
      to: string;
      salaryMonth?: number;
      salaryYear?: number;
    }
  | {
      ok: false;
      reason: 'salary_not_found' | 'invalid_period' | 'query_failed';
    };

const inputClass =
  'min-h-11 min-w-0 bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-2.5 py-1.5 text-xs focus-visible:outline-emerald-400';

export function createInitialPeriodValue(now = new Date(), restoreQuery = false): PeriodValue {
  const range = currentMonthRange(now);
  const salaryMonth = Number(range.from.slice(5, 7));
  const salaryYear = Number(range.from.slice(0, 4));

  if (restoreQuery && typeof window !== 'undefined') {
    const query = new URLSearchParams(window.location.search);
    const mode = query.get('period');
    if (mode === 'custom') {
      const from = query.get('from') ?? '';
      const to = query.get('to') ?? '';
      if (isBusinessDate(from) && isBusinessDate(to) && from <= to) {
        return { mode, from, to, salaryMonth, salaryYear, valid: true };
      }
    }
    if (mode === 'salary_cycle') {
      const salaryMonth = Number(query.get('salary_month'));
      const salaryYear = Number(query.get('salary_year'));
      if (Number.isInteger(salaryMonth) && salaryMonth >= 1 && salaryMonth <= 12 && Number.isInteger(salaryYear) && salaryYear >= 1900 && salaryYear <= 9999) {
        return { mode, from: range.from, to: range.to, salaryMonth, salaryYear, valid: false };
      }
    }
  }
  return {
    mode: 'this_month',
    from: range.from,
    to: range.to,
    salaryMonth,
    salaryYear,
    valid: true,
  };
}

export function PeriodControl({ accountId, value, onChange, className = '' }: PeriodControlProps) {
  const t = useTranslations('period');
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [retry, setRetry] = useState(0);
  const onChangeRef = useRef(onChange);
  const accountIdRef = useRef(accountId);
  const valueRef = useRef(value);
  const currentValueKeyRef = useRef(valueKey(value));

  accountIdRef.current = accountId;
  valueRef.current = value;
  currentValueKeyRef.current = valueKey(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const emitValue = useCallback((nextValue: PeriodValue) => {
    const nextKey = valueKey(nextValue);
    if (nextKey === currentValueKeyRef.current) return;

    onChangeRef.current(nextValue);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('period', value.mode);
    if (value.mode === 'salary_cycle') {
      url.searchParams.set('salary_month', String(value.salaryMonth));
      url.searchParams.set('salary_year', String(value.salaryYear));
    } else {
      url.searchParams.delete('salary_month');
      url.searchParams.delete('salary_year');
    }
    if (value.valid) {
      url.searchParams.set('from', value.from);
      url.searchParams.set('to', value.to);
    }
    window.history.replaceState(null, '', url);
  }, [value.mode, value.from, value.to, value.salaryMonth, value.salaryYear, value.valid]);

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return {
          value: month,
          label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(
            new Date(2024, index, 1),
          ),
        };
      }),
    [locale],
  );

  const years = useMemo(() => {
    const currentYear = Number(currentMonthRange().from.slice(0, 4));
    return [...new Set([...Array.from({ length: 7 }, (_, index) => currentYear - 3 + index), value.salaryYear])].sort((a, b) => a - b);
  }, [value.salaryYear]);

  useEffect(() => {
    if (value.mode !== 'salary_cycle') {
      setResolving(false);
      return;
    }
    if (!accountId) {
      setResolving(false);
      return;
    }

    const controller = new AbortController();
    const requestKey = [accountId, value.salaryMonth, value.salaryYear].join('|');
    const params = new URLSearchParams({
      account_id: accountId,
      period: 'salary_cycle',
      salary_month: String(value.salaryMonth),
      salary_year: String(value.salaryYear),
    });

    setResolving(true);
    setError(null);
    emitValue({ ...valueRef.current, valid: false });

    fetch(`/api/period?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as PeriodApiResponse;
        const isStale =
          controller.signal.aborted ||
          valueRef.current.mode !== 'salary_cycle' ||
          currentSalaryRequestKey(accountIdRef.current, valueRef.current) !== requestKey;
        if (isStale) return;

        if (!response.ok || !data.ok) {
          setError(periodErrorMessage(data, t));
          emitValue({ ...valueRef.current, valid: false });
          return;
        }

        emitValue({
          ...valueRef.current,
          from: data.from,
          to: data.to,
          salaryMonth: data.salaryMonth ?? value.salaryMonth,
          salaryYear: data.salaryYear ?? value.salaryYear,
          valid: true,
          resolvedAccountId: accountId,
        });
      })
      .catch((resolveError: unknown) => {
        if (resolveError instanceof DOMException && resolveError.name === 'AbortError') return;
        if (
          controller.signal.aborted ||
          valueRef.current.mode !== 'salary_cycle' ||
          currentSalaryRequestKey(accountIdRef.current, valueRef.current) !== requestKey
        ) {
          return;
        }

        setError(t('resolveFailed'));
        emitValue({ ...valueRef.current, valid: false });
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          valueRef.current.mode === 'salary_cycle' &&
          currentSalaryRequestKey(accountIdRef.current, valueRef.current) === requestKey
        ) {
          setResolving(false);
        }
      });

    return () => controller.abort();
  }, [accountId, emitValue, t, value.mode, value.salaryMonth, value.salaryYear, retry]);

  function selectThisMonth() {
    setError(null);
    emitValue(createInitialPeriodValue());
  }

  function selectSalaryCycle() {
    setError(null);
    emitValue({
      ...value,
      mode: 'salary_cycle',
      salaryMonth: value.salaryMonth || createInitialPeriodValue().salaryMonth,
      salaryYear: value.salaryYear || createInitialPeriodValue().salaryYear,
      valid: false,
    });
  }

  function selectCustom() {
    const nextValue = { ...value, mode: 'custom' as const };
    const valid = validateCustomRange(nextValue);
    setError(valid ? null : t('invalidPeriod'));
    emitValue({ ...nextValue, valid });
  }

  function updateSalaryTarget(next: { salaryMonth?: number; salaryYear?: number }) {
    emitValue({
      ...value,
      ...next,
      mode: 'salary_cycle',
      valid: false,
    });
  }

  function updateCustomRange(next: { from?: string; to?: string }) {
    const nextValue = {
      ...value,
      ...next,
      mode: 'custom' as const,
    };
    const valid = validateCustomRange(nextValue);

    setError(valid ? null : t('invalidPeriod'));
    emitValue({ ...nextValue, valid });
  }

  const showError = error || (!value.valid && value.mode === 'custom' ? t('invalidPeriod') : null);

  return (
    <div className={`max-w-full space-y-2 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="grid grid-cols-3 items-center gap-1.5 sm:flex sm:flex-wrap">
          <ModeButton active={value.mode === 'this_month'} onClick={selectThisMonth}>
            {t('thisMonth')}
          </ModeButton>
          <ModeButton active={value.mode === 'salary_cycle'} onClick={selectSalaryCycle}>
            {t('salaryCycle')}
          </ModeButton>
          <ModeButton active={value.mode === 'custom'} onClick={selectCustom}>
            {t('custom')}
          </ModeButton>
        </div>

        {value.mode === 'salary_cycle' && (
          <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
            <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5 text-xs text-white/70 sm:flex">
              <span>{t('month')}</span>
              <select
                value={value.salaryMonth}
                onChange={(event) =>
                  updateSalaryTarget({ salaryMonth: Number(event.target.value) })
                }
                className={`${inputClass} w-full sm:w-auto`}
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value} className="bg-[#1a1a1f] text-white">
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5 text-xs text-white/70 sm:flex">
              <span>{t('year')}</span>
              <select
                value={value.salaryYear}
                onChange={(event) => updateSalaryTarget({ salaryYear: Number(event.target.value) })}
                className={`${inputClass} w-full sm:w-auto`}
              >
                {years.map((year) => (
                  <option key={year} value={year} className="bg-[#1a1a1f] text-white">
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {value.mode === 'custom' && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:flex-wrap">
            <input
              type="date"
              aria-label={t('from')}
              value={value.from}
              onChange={(event) => updateCustomRange({ from: event.target.value })}
              className={`${inputClass} w-full sm:w-auto`}
              style={{
                colorScheme: 'dark',
                maxWidth: '100%',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            />
            <span className="text-xs text-white/30">-</span>
            <input
              type="date"
              aria-label={t('to')}
              value={value.to}
              onChange={(event) => updateCustomRange({ to: event.target.value })}
              className={`${inputClass} w-full sm:w-auto`}
              style={{
                colorScheme: 'dark',
                maxWidth: '100%',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {value.valid && <span className="text-white/70">{t('range', { from: value.from, to: value.to })}</span>}
        {resolving && <span role="status" className="text-white/70">{t('resolving')}</span>}
      </div>

      {showError && <div role="alert" className="text-sm text-red-300">{showError}{value.mode === 'salary_cycle' && <button type="button" onClick={() => setRetry(n => n + 1)} className="ml-2 min-h-11 rounded border border-white/20 px-3 text-white focus-visible:outline-emerald-400">{t('retry')}</button>}</div>}
    </div>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'min-h-11 w-full rounded-lg border px-2.5 py-1.5 text-center text-xs font-medium transition-colors focus-visible:outline-emerald-400 sm:w-auto ' +
        (active
          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
          : 'border-white/[0.08] bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white/70')
      }
    >
      {children}
    </button>
  );
}

function validateCustomRange(value: PeriodValue): boolean {
  return isBusinessDate(value.from) && isBusinessDate(value.to) && value.from <= value.to;
}

function periodErrorMessage(
  response: PeriodApiResponse,
  t: (key: 'salaryMissing' | 'invalidPeriod' | 'resolveFailed') => string,
): string {
  if (response.ok) return t('resolveFailed');
  if (response.reason === 'salary_not_found') return t('salaryMissing');
  if (response.reason === 'invalid_period') return t('invalidPeriod');

  return t('resolveFailed');
}

function valueKey(value: PeriodValue): string {
  return [
    value.mode,
    value.from,
    value.to,
    value.salaryMonth,
    value.salaryYear,
    value.valid ? 'valid' : 'invalid',
    value.resolvedAccountId ?? '',
  ].join('|');
}

function currentSalaryRequestKey(accountId: string, value: PeriodValue): string {
  return [accountId, value.salaryMonth, value.salaryYear].join('|');
}
