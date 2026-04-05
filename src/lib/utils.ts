export function formatIDR(amount: number): string {
  return 'Rp' + amount.toLocaleString('id-ID');
}

export function formatDate(dateStr: string, locale = 'id-ID'): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}
