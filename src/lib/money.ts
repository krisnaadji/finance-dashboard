export function cents(value: string): bigint {
  if (!/^-?(?:0|[1-9]\d*)\.\d{2}$/.test(value)) throw new Error('Invalid canonical money');
  const negative = value.startsWith('-');
  const [whole, fraction] = (negative ? value.slice(1) : value).split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction);
  return negative ? -result : result;
}

export function decimal(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const n = value < 0n ? -value : value;
  return `${sign}${n / 100n}.${String(n % 100n).padStart(2, '0')}`;
}

export function compareMoney(a: string, b: string): number {
  const left = cents(a), right = cents(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function subtractMoney(a: string, b: string): string {
  return decimal(cents(a) - cents(b));
}

export function formatMoney(value: string): string {
  const normalized = decimal(cents(value));
  const [whole, fraction] = normalized.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction === '00' ? '' : ',' + fraction);
}

export function budgetPercent(spent: string, limit: string): number {
  const numerator = cents(spent), denominator = cents(limit);
  if (denominator <= 0n || numerator < 0n) throw new Error('Invalid budget ratio');
  return Number(numerator * 10_000n / denominator) / 100;
}
