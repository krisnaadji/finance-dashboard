import { businessDate, currentMonthRange } from './business-date';

export function formatIDR(amount: number): string {
  return 'Rp' + amount.toLocaleString('id-ID');
}

export function formatDate(dateStr: string, locale = 'id-ID'): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function startOfMonth(): string {
  return currentMonthRange().from;
}

export function today(): string {
  return businessDate(new Date());
}
