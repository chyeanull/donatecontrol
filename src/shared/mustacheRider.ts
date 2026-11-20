import type { DonationAlert } from './models';

// Shared by server playback, live graphics, and the dashboard preview.
// Play the opening 1.5 seconds of cha-ching before feeding paper.
const cashLeadInMs = 1500;
const printMs = 2400, tearMs = 300, settleMs = 900;
const receiptInMs = printMs + tearMs + settleMs;
export const mustacheRiderMotion = {
  hotdogInMs: 900, mustardInMs: 1800,
  cashLeadInMs, printMs, tearMs, settleMs, receiptInMs,
  alertInMs: cashLeadInMs + receiptInMs, holdMs: 10000, alertOutMs: 1400,
  messagePauseMs: 1000, messageLineMs: 1600,
  fadeInMs: 300, fadeOutMs: 300, hotdogOutMs: 900,
} as const;

/** Includes the exit, so other sends stay locked until the paper is gone. */
export function isMustacheRiderFade(alert: DonationAlert) {
  return Boolean(alert.donation && alert.playback?.theme === 'mustacherider' && alert.playback.receiptMode === 'fade');
}

// Keep the schema compatible with the older two-second reading budgets.
// Normal short receipts still hold for 10 seconds.
export const MAX_RECEIPT_HOLD_MS = 2000 * 2000 + 2000;
export function mustacheRiderHoldMs(message?: string) {
  const text = message?.trim();
  if (!text) return mustacheRiderMotion.holdMs;
  // Budget conservatively for wrapping in the fixed 544px message column.
  // Count explicit line breaks, tabs and wide characters as well as plain text.
  const lines = text.split(/\r\n?|\n/).reduce((total, line) => {
    const cells = [...line].reduce((width, char) => width + (char === '\t' ? 8 : char.codePointAt(0)! >= 0x2e80 ? 2 : 1), 0);
    return total + Math.max(1, Math.ceil(cells / 25));
  }, 0);
  return lines <= 10 ? mustacheRiderMotion.holdMs
    : Math.min(MAX_RECEIPT_HOLD_MS, Math.max(20000, lines * mustacheRiderMotion.messageLineMs + 2 * mustacheRiderMotion.messagePauseMs));
}

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
