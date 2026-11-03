export function percentage(raised: number, goal: number): number {
  if (!Number.isFinite(raised) || !Number.isFinite(goal) || goal <= 0 || raised < 0) return 0;
  const result = (raised / goal) * 100;
  return Number.isFinite(result) ? Math.round(result * 100) / 100 : 0;
}
export function formatCurrency(amount: number, currency = 'USD', decimals = true): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency,
      ...(decimals ? {} : { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    }).format(safe);
  } catch { return `${safe.toFixed(decimals ? 2 : 0)} ${currency}`; }
}
export function clockTime(value: string | null): string {
  return value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}
