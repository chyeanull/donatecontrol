import { afterEach, describe, expect, it, vi } from 'vitest';
import { percentage, formatCurrency } from '../src/shared/format';
import { detectDonations } from '../src/extension/services/donationService';
import { AlertQueue } from '../src/extension/services/alertQueue';
import { PollingService, backoffMs } from '../src/extension/services/pollingService';
import { ProviderError } from '../src/extension/providers/FundraisingProvider';
import { defaults, DEFAULT_ANIMATION_IN_MS, DEFAULT_ANIMATION_OUT_MS, type Donation, type DonationAlert } from '../src/shared/models';

const donor = (id: string, timestamp = '2026-10-02T12:00:01.000Z'): Donation => ({ id, donorName: 'Rob', amount: 50, currency: 'USD', timestamp, anonymous: false });
afterEach(() => vi.useRealTimers());
describe('broadcast numbers', () => {
  it('calculates percentage safely, including an exceeded or missing goal', () => {
    expect(percentage(12500, 25000)).toBe(50);
    expect(percentage(30000, 25000)).toBe(120);
    expect(percentage(10, 0)).toBe(0);
    expect(percentage(NaN, 100)).toBe(0);
    expect(percentage(10, Infinity)).toBe(0);
    expect(percentage(-10, 100)).toBe(0);
  });
  it('uses ISO currency precision and handles invalid values', () => {
    expect(formatCurrency(50, 'USD')).toBe('$50.00');
    expect(formatCurrency(12500, 'USD', false)).toBe('$12,500');
    expect(formatCurrency(2500, 'JPY')).toBe('¥2,500');
    expect(formatCurrency(NaN, 'USD')).toBe('$0.00');
    expect(formatCurrency(20, 'not-currency')).toBe('20.00 not-currency');
  });
});
describe('donation detection', () => {
  it('baselines history, deduplicates repeated IDs, and orders new donations', () => {
    const first = detectDonations([donor('old')], defaults.donationLedger, 'mock:demo', true, '2026-10-02T12:00:00.000Z');
    expect(first.newDonations).toHaveLength(0);
    const second = detectDonations([donor('old'), donor('two', '2026-10-02T12:00:03.000Z'), donor('one'), donor('one')], first.ledger, 'mock:demo', false);
    expect(second.newDonations.map((d) => d.id)).toEqual(['one', 'two']);
    expect(detectDonations([donor('one')], second.ledger, 'mock:demo', false).newDonations).toHaveLength(0);
  });
  it('does not replay history after restart or alert on older late-arriving history', () => {
    const result = detectDonations([donor('old')], defaults.donationLedger, 'pro:1', true, '2026-10-02T12:00:02.000Z');
    const restarted = detectDonations([donor('old'), donor('during-downtime')], result.ledger, 'pro:1', true, '2026-10-02T12:00:05.000Z');
    expect(restarted.newDonations).toHaveLength(0);
    expect(detectDonations([donor('unknown-old')], restarted.ledger, 'pro:1', false).newDonations).toHaveLength(0);
  });
  it('keeps only the most recent 50 history entries and isolates campaign IDs', () => {
    const first = detectDonations(Array.from({ length: 80 }, (_, n) => donor(String(n))), defaults.donationLedger, 'a', true);
    expect(first.recent).toHaveLength(50);
    const switched = detectDonations([donor('next')], first.ledger, 'b', true);
    expect(switched.ledger.seenIds).toEqual(['next']);
    expect(switched.newDonations).toHaveLength(0);
  });
});
describe('server alert queue', () => {
  it('plays exactly once, in order, with a complete exit between donations', () => {
    vi.useFakeTimers();
    let latest: DonationAlert = defaults.currentAlert;
    const queue = new AlertQueue((value) => { latest = value; }, () => 2);
    queue.enqueue(donor('one')); queue.enqueue(donor('two')); queue.enqueue(donor('one'));
    expect(latest.donation?.id).toBe('one'); expect(latest.queued).toBe(1);
    vi.advanceTimersByTime(2000 + DEFAULT_ANIMATION_IN_MS);
    expect(latest.visible).toBe(false); expect(latest.donation?.id).toBe('one');
    vi.advanceTimersByTime(DEFAULT_ANIMATION_OUT_MS);
    expect(latest.visible).toBe(true); expect(latest.donation?.id).toBe('two');
    vi.advanceTimersByTime(2000 + DEFAULT_ANIMATION_IN_MS + DEFAULT_ANIMATION_OUT_MS);
    expect(latest.donation).toBeNull();
    queue.enqueue(donor('two')); expect(latest.donation).toBeNull();
    queue.stop();
  });
  it('clears only pending donations and dismisses the current one gracefully', () => {
    vi.useFakeTimers();
    let latest: DonationAlert = defaults.currentAlert;
    const queue = new AlertQueue((value) => { latest = value; }, () => 6);
    queue.enqueue(donor('one')); queue.enqueue(donor('two')); queue.clear();
    expect(latest.visible).toBe(true); expect(latest.queued).toBe(0);
    queue.dismiss(); queue.dismiss(); vi.advanceTimersByTime(DEFAULT_ANIMATION_OUT_MS);
    expect(latest.donation).toBeNull(); queue.stop();
  });
});
describe('polling', () => {
  it('respects Retry-After, prevents manual hammering, and resumes after backoff', async () => {
    vi.useFakeTimers();
    const task = vi.fn().mockRejectedValueOnce(new ProviderError('Rate limited', true, 60000)).mockResolvedValue(undefined);
    const onError = vi.fn();
    const poller = new PollingService(task, () => 15000, onError);
    await expect(poller.start()).rejects.toThrow('Rate limited');
    await expect(poller.refresh()).rejects.toThrow('retry delay');
    await vi.advanceTimersByTimeAsync(59999); expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(task).toHaveBeenCalledTimes(2);
    poller.stop();
  });
  it('does not retry terminal errors, and coalesces overlapping requests', async () => {
    vi.useFakeTimers();
    const task = vi.fn().mockRejectedValue(new ProviderError('Bad credentials'));
    const poller = new PollingService(task, () => 15000, () => {});
    const first = poller.start(); expect(poller.refresh()).toBe(first);
    await expect(first).rejects.toThrow('Bad credentials');
    await vi.advanceTimersByTimeAsync(300000); expect(task).toHaveBeenCalledTimes(1);
    poller.stop();
    expect(backoffMs(9, 15000)).toBe(300000);
    expect(backoffMs(1, 15000, 3600000)).toBe(3600000);
  });
});
