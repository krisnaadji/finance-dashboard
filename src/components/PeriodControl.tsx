'use client';

import { currentMonthRange } from '@/lib/reporting-period';
import { useTranslations } from 'next-intl';
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
  'bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400/50';

export function createInitialPeriodValue(now = new Date()): PeriodValue {
  const range = currentMonthRange(now);

  return {
    mode: 'this_month',
    from: range.from,
    to: range.to,
    salaryMonth: now.getMonth() + 1,
    salaryYear: now.getFullYear(),
    valid: true,
  };
}

export function PeriodControl({ accountId, value, onChange, className = '' }: PeriodControlProps) {
  const t = useTranslations('period');
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
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

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return {
          value: month,
          label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(
            new Date(2024, index, 1),
          ),
        };
      }),
    [],
  );

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => currentYear - 3 + index);
  }, []);

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
  }, [accountId, emitValue, t, value.mode, value.salaryMonth, value.salaryYear]);

  function selectThisMonth() {
    setError(null);
    emitValue(createInitialPeriodValue());
  }

  function selectSalaryCycle() {
    setError(null);
    emitValue({
      ...value,
      mode: 'salary_cycle',
      salaryMonth: value.salaryMonth || new Date().getMonth() + 1,
      salaryYear: value.salaryYear || new Date().getFullYear(),
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
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5">
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
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-white/40">
            <span>{t('month')}</span>
            <select
              value={value.salaryMonth}
              onChange={(event) => updateSalaryTarget({ salaryMonth: Number(event.target.value) })}
              className={inputClass}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value} className="bg-[#1a1a1f] text-white">
                  {month.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-white/40">
            <span>{t('year')}</span>
            <select
              value={value.salaryYear}
              onChange={(event) => updateSalaryTarget({ salaryYear: Number(event.target.value) })}
              className={inputClass}
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
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={value.from}
            onChange={(event) => updateCustomRange({ from: event.target.value })}
            className={inputClass}
            style={{ colorScheme: 'dark' }}
          />
          <span className="text-xs text-white/30">-</span>
          <input
            type="date"
            value={value.to}
            onChange={(event) => updateCustomRange({ to: event.target.value })}
            className={inputClass}
            style={{ colorScheme: 'dark' }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={value.valid ? 'text-white/40' : 'text-white/25'}>
          {t('range', { from: value.from || '-', to: value.to || '-' })}
        </span>
        {resolving && <span className="text-white/25">...</span>}
      </div>

      {showError && <p className="text-xs text-red-300/80">{showError}</p>}
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
      className={
        'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ' +
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
  return Boolean(value.from && value.to && value.from <= value.to);
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
  ].join('|');
}

function currentSalaryRequestKey(accountId: string, value: PeriodValue): string {
  return [accountId, value.salaryMonth, value.salaryYear].join('|');
}
