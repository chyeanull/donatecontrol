import { describe, expect, it } from 'vitest';
import { mustacheRiderScale } from '../src/shared/mustacheRider';

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
