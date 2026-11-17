// Shared by server playback, live graphics, and the dashboard preview.
export const mustacheRiderMotion = {
  hotdogInMs: 900, mustardInMs: 1800,
  printMs: 2400, tearMs: 300, settleMs: 900,
  alertInMs: 3600, holdMs: 10000, alertOutMs: 1400,
} as const;

/** Six bun labels span the effective campaign goal (including local overrides). */
export function mustacheRiderScale(raised: number, goal: number, currency: string) {
  const hasGoal = Number.isFinite(goal) && goal > 0;
  const progress = hasGoal && Number.isFinite(raised) ? Math.min(1, Math.max(0, raised / goal)) : 0;
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 2 });
  } catch {
    formatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  }
  return { hasGoal, progress, labels: hasGoal ? Array.from({ length: 6 }, (_, index) => formatter.format(goal * (index / 5))) : [] };
}
