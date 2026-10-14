import { businessDate, currentMonthRange } from './business-date';
import { formatMoney } from './money';

export function formatIDR(amount: string | number): string {
  return 'Rp' + (typeof amount === 'string' ? formatMoney(amount) : amount.toLocaleString('id-ID'));
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
