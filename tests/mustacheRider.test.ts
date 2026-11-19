import { describe, expect, it } from 'vitest';
import { mustacheRiderHoldMs, mustacheRiderScale } from '../src/shared/mustacheRider';
import { resolveAlertPlayback } from '../src/shared/appearance';
import { defaults, alertPlaybackSchema } from '../src/shared/models';

describe('MustacheRider reading time', () => {
  it('keeps short receipts at ten seconds and gives longer messages more reading time', () => {
    expect(mustacheRiderHoldMs()).toBe(10000);
    expect(mustacheRiderHoldMs('Thank you for making a difference!')).toBe(10000);
    const long = 'Thank you for making a difference! '.repeat(20);
    expect(mustacheRiderHoldMs(long)).toBeGreaterThanOrEqual(20000);
    expect(mustacheRiderHoldMs(long.repeat(2))).toBeGreaterThan(mustacheRiderHoldMs(long));
    const appearance = { ...defaults.overlayAppearance, theme: 'mustacherider' as const };
    expect(resolveAlertPlayback(appearance, 2, long).holdMs).toBe(mustacheRiderHoldMs(long));
    expect(resolveAlertPlayback(defaults.overlayAppearance, 3, long).holdMs).toBe(3000);
  });

  it('budgets for explicit line breaks and wide text, including the longest allowed messages', () => {
    expect(mustacheRiderHoldMs('Thank you!\n'.repeat(25))).toBeGreaterThan(30000);
    expect(mustacheRiderHoldMs('支持'.repeat(300))).toBeGreaterThan(mustacheRiderHoldMs('ab'.repeat(300)));
    for (const message of ['x'.repeat(2000), 'x\n'.repeat(1000)]) {
      expect(alertPlaybackSchema.safeParse(resolveAlertPlayback({ ...defaults.overlayAppearance, theme: 'mustacherider' }, 2, message)).success).toBe(true);
    }
  });
});

describe('MustacheRider funding scale', () => {
  it('matches the supplied $25K reference and uses the exact funding ratio', () => {
    expect(mustacheRiderScale(5000, 25000, 'USD')).toEqual({ hasGoal: true, progress: .2, labels: ['$0', '$5K', '$10K', '$15K', '$20K', '$25K'] });
    expect(mustacheRiderScale(15000, 25000, 'USD').progress).toBe(.6);
    expect(mustacheRiderScale(1234.56, 25000, 'USD').progress).toBe(1234.56 / 25000);
  });

  it('recalculates the mustard and labels when an effective/custom goal changes', () => {
    expect(mustacheRiderScale(5000, 10000, 'GBP')).toEqual({ hasGoal: true, progress: .5, labels: ['£0', '£2K', '£4K', '£6K', '£8K', '£10K'] });
    expect(mustacheRiderScale(5000, 25000, 'GBP').progress).toBe(.2);
    expect(mustacheRiderScale(15, 125.5, 'EUR').labels).toEqual(['€0', '€25.1', '€50.2', '€75.3', '€100.4', '€125.5']);
    expect(mustacheRiderScale(1000000, 2500000, 'USD').labels.at(-1)).toBe('$2.5M');
  });

  it('keeps zero, invalid, and exceeded goals safe without overshooting the artwork', () => {
    expect(mustacheRiderScale(0, 25000, 'USD').progress).toBe(0);
    expect(mustacheRiderScale(30000, 25000, 'USD').progress).toBe(1);
    expect(mustacheRiderScale(-1, 25000, 'USD').progress).toBe(0);
    for (const goal of [0, -1, Infinity, NaN]) {
      expect(mustacheRiderScale(500, goal, 'USD')).toEqual({ hasGoal: false, progress: 0, labels: [] });
    }
  });
});
