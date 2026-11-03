import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertQueue } from '../src/extension/services/alertQueue';
import { CampaignService, type StateStore } from '../src/extension/services/campaignService';
import { defaults, schemas, type AlertPlayback, type Donation, type DonationAlert, type Replicants } from '../src/shared/models';

const donor = (id: string): Donation => ({ id, donorName: id, amount: 25, currency: 'USD', timestamp: '', anonymous: false });
afterEach(() => vi.useRealTimers());

describe('animation time around the fully-visible alert duration', () => {
  it('adds entrance and exit to the hold, without overlapping queued alerts or counting them early', () => {
    vi.useFakeTimers();
    let alert: DonationAlert = defaults.currentAlert;
    const started = vi.fn();
    const playback: AlertPlayback = { animation: 'draw-left', animationInMs: 800, animationOutMs: 300 };
    const queue = new AlertQueue(value => { alert = value; }, () => 6, undefined, started, () => playback);
    queue.enqueue(donor('one'), 'entry-one'); queue.enqueue(donor('two'), 'entry-two');
    expect(alert.playback).toEqual(playback);
    vi.advanceTimersByTime(6799);
    expect(alert.visible).toBe(true); expect(started.mock.calls).toEqual([['entry-one']]);
    vi.advanceTimersByTime(1);
    expect(alert.visible).toBe(false); expect(alert.donation?.id).toBe('one');
    vi.advanceTimersByTime(299);
    expect(alert.donation?.id).toBe('one');
    vi.advanceTimersByTime(1);
    expect(alert.visible).toBe(true); expect(alert.donation?.id).toBe('two');
    expect(started.mock.calls).toEqual([['entry-one'], ['entry-two']]);
    queue.stop();
  });

  it('snapshots current timing and animation, then uses new settings for the next queued alert', () => {
    vi.useFakeTimers();
    const state = structuredClone(defaults);
    const store: StateStore = {
      get: <K extends keyof Replicants>(key: K) => structuredClone(state[key]),
      set: <K extends keyof Replicants>(key: K, value: Replicants[K]) => { schemas[key].parse(value); state[key] = structuredClone(value); },
    };
    state.overlayAppearance = { ...state.overlayAppearance, alertAnimation: 'soft-zoom', thermometerAnimation: 'draw-left', animationInMs: 1200, animationOutMs: 900 };
    state.settings.alertDurationSeconds = 3;
    const service = new CampaignService(store, () => {}, () => ({}));
    service.testAlert(); service.testAlert();
    const firstId = state.currentAlert.donation!.id;
    vi.advanceTimersByTime(400);
    state.overlayAppearance = { ...state.overlayAppearance, alertAnimation: 'rise-fade', thermometerAnimation: 'soft-zoom', animationInMs: 0, animationOutMs: 250 };
    service.saveSettings({ alertDurationSeconds: 2, pollingIntervalSeconds: 15 });
    expect(state.currentAlert.playback).toEqual({ animation: 'soft-zoom', animationInMs: 1200, animationOutMs: 900 });
    vi.advanceTimersByTime(3800);
    expect(state.currentAlert.visible).toBe(false);
    vi.advanceTimersByTime(899);
    expect(state.currentAlert.donation!.id).toBe(firstId);
    vi.advanceTimersByTime(1);
    expect(state.currentAlert.donation!.id).not.toBe(firstId);
    expect(state.currentAlert.playback).toEqual({ animation: 'rise-fade', animationInMs: 0, animationOutMs: 250 });
    vi.advanceTimersByTime(1999); expect(state.currentAlert.visible).toBe(true);
    vi.advanceTimersByTime(1); expect(state.currentAlert.visible).toBe(false);
    vi.advanceTimersByTime(250); expect(state.currentAlert.donation).toBeNull();
    service.alerts.stop();
  });

  it.each([[0, 0], [0, 10000], [10000, 0], [10000, 10000]])('supports %i ms in and %i ms out without a hidden fixed gap', (animationInMs, animationOutMs) => {
    vi.useFakeTimers();
    let alert: DonationAlert = defaults.currentAlert;
    const queue = new AlertQueue(value => { alert = value; }, () => 2, undefined, undefined,
      () => ({ animation: 'rise-fade', animationInMs, animationOutMs }));
    queue.enqueue(donor('one'));
    vi.advanceTimersByTime(animationInMs + 1999); expect(alert.visible).toBe(true);
    vi.advanceTimersByTime(1); expect(alert.visible).toBe(false);
    // A 0 ms timeout still uses the next event-loop turn, never a fixed exit allowance.
    vi.runAllTimers(); expect(alert.donation).toBeNull();
    queue.stop();
  });

  it('lets an early dismissal use the captured exit and cancels all callbacks when stopped', () => {
    vi.useFakeTimers();
    let alert: DonationAlert = defaults.currentAlert;
    const publish = vi.fn((value: DonationAlert) => { alert = value; });
    const queue = new AlertQueue(publish, () => 6, undefined, undefined,
      () => ({ animation: 'draw-left', animationInMs: 2000, animationOutMs: 750 }));
    queue.enqueue(donor('one')); queue.enqueue(donor('two'));
    vi.advanceTimersByTime(100);
    queue.dismiss(); queue.dismiss();
    vi.advanceTimersByTime(749); expect(alert.donation?.id).toBe('one');
    vi.advanceTimersByTime(1); expect(alert.donation?.id).toBe('two');
    queue.stop(); const calls = publish.mock.calls.length;
    vi.runAllTimers(); expect(publish).toHaveBeenCalledTimes(calls); expect(alert.donation).toBeNull();
  });
});
