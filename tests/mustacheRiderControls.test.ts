import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampaignService, type StateStore } from '../src/extension/services/campaignService';
import { defaults, schemas, type Replicants } from '../src/shared/models';
import { isMustacheRiderFade } from '../src/shared/mustacheRider';

async function setup(theme: 'mustacherider' | 'classic' = 'mustacherider') {
  vi.useFakeTimers();
  const state = structuredClone(defaults);
  state.overlayAppearance.theme = theme;
  const store: StateStore = {
    get: <K extends keyof Replicants>(key: K) => structuredClone(state[key]),
    set: <K extends keyof Replicants>(key: K, value: Replicants[K]) => {
      schemas[key].parse(value); state[key] = structuredClone(value);
    },
  };
  const service = new CampaignService(store, () => {}, () => ({}));
  await service.connect(state.settings);
  return { state, service, entryId: state.donationHistory[0].id };
}
afterEach(() => vi.useRealTimers());

describe('MustacheRider producer controls', () => {
  it('holds a faded receipt indefinitely, counts once and locks every send until its exit completes', async () => {
    const { state, service, entryId } = await setup();
    service.sendDonationWithFade({ entryId });
    const playbackId = state.currentAlert.donation!.id;
    expect(state.currentAlert.playback).toMatchObject({ theme: 'mustacherider', receiptMode: 'fade', animationInMs: 300, animationOutMs: 300 });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(state.currentAlert.visible).toBe(true);
    expect(state.donationHistory[0].sentCount).toBe(1);
    expect(() => service.sendDonation({ entryId })).toThrow(/Fade out/);
    expect(() => service.testAlert()).toThrow(/Fade out/);
    expect(() => service.sendDonationWithFade({ entryId })).toThrow(/Fade out/);
    await expect(service.addMockDonation({ donorName: 'Blocked', amount: 10 })).rejects.toThrow(/Fade out/);
    service.fadeOutReceipt({ entryId, playbackId });
    expect(state.currentAlert.visible).toBe(false);
    expect(isMustacheRiderFade(state.currentAlert)).toBe(true);
    expect(() => service.sendDonation({ entryId })).toThrow(/Fade out/);
    await vi.advanceTimersByTimeAsync(299);
    expect(service.alerts.fadeLocked).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(service.alerts.fadeLocked).toBe(false);
    service.sendDonation({ entryId });
    expect(state.currentAlert.playback?.receiptMode).toBeUndefined();
    expect(state.donationHistory[0].sentCount).toBe(2);
    await service.disconnect();
  });

  it('archives automatic arrivals and updates totals immediately, then resumes playback after fade-out', async () => {
    const { state, service, entryId } = await setup();
    service.sendDonationWithFade({ entryId });
    const playbackId = state.currentAlert.donation!.id;
    state.mockState.donations.push({ id: 'provider-arrival', donorName: 'New arrival', amount: 20, currency: 'USD', anonymous: false, timestamp: new Date().toISOString() });
    state.mockState.campaign.raised += 20;
    await service.refresh();
    expect(state.campaign.raised).toBe(12520);
    expect(state.donationHistory.at(-1)).toMatchObject({ donorName: 'New arrival', sentCount: 0 });
    expect(state.currentAlert).toMatchObject({ visible: true, queued: 1, donation: { id: playbackId } });
    service.fadeOutReceipt({ entryId, playbackId });
    await vi.advanceTimersByTimeAsync(300);
    expect(state.currentAlert.donation?.id).toBe('provider-arrival');
    expect(state.donationHistory.at(-1)?.sentCount).toBe(1);
    await service.disconnect();
  });

  it('keeps manual arrivals held and ignores stale fade-out commands', async () => {
    const { state, service, entryId } = await setup();
    service.sendDonationWithFade({ entryId });
    const previousId = state.currentAlert.donation!.id;
    service.alerts.enqueue({ ...state.donationHistory[1].donation, id: 'pending' }, state.donationHistory[1].id);
    service.setManualAlertControl({ manual: true });
    expect(state.currentAlert.queued).toBe(0);
    expect(() => service.fadeOutReceipt({ entryId, playbackId: 'stale' })).toThrow(/no longer/);
    expect(state.currentAlert.visible).toBe(true);
    service.fadeOutReceipt({ entryId, playbackId: previousId });
    await vi.advanceTimersByTimeAsync(300);
    expect(state.currentAlert.donation).toBeNull();
    service.sendDonationWithFade({ entryId });
    expect(() => service.fadeOutReceipt({ entryId, playbackId: previousId })).toThrow(/no longer/);
    expect(state.currentAlert.visible).toBe(true);
    await service.disconnect();
    expect(isMustacheRiderFade(state.currentAlert)).toBe(false);
  });

  it('requires MustacheRider, the connected campaign and an idle overlay', async () => {
    const { state, service, entryId } = await setup('classic');
    expect(() => service.sendDonationWithFade({ entryId })).toThrow(/only for MustacheRider/);
    expect(() => service.setMustacheRiderThermometer({ visible: false })).toThrow(/only for MustacheRider/);
    service.sendDonation({ entryId });
    state.overlayAppearance.theme = 'mustacherider';
    expect(() => service.sendDonationWithFade({ entryId })).toThrow(/current alert/);
    service.alerts.stop();
    state.donationLedger.campaignKey = 'another-campaign';
    expect(() => service.sendDonationWithFade({ entryId })).toThrow(/Connect/);
    await service.disconnect();
    expect(() => service.sendDonationWithFade({ entryId })).toThrow(/Connect/);
  });

  it('keeps thermometer visibility independent of alert playback and campaign refreshes', async () => {
    const { state, service, entryId } = await setup();
    expect(state.mustacheRiderControls.thermometerVisible).toBe(true);
    service.setMustacheRiderThermometer({ visible: false });
    service.sendDonationWithFade({ entryId });
    await service.refresh();
    expect(state.mustacheRiderControls.thermometerVisible).toBe(false);
    service.setMustacheRiderThermometer({ visible: true });
    expect(state.currentAlert.visible).toBe(true);
    expect(state.mustacheRiderControls.thermometerVisible).toBe(true);
    service.setMustacheRiderThermometer({ visible: false });
    await service.disconnect();
    expect(state.mustacheRiderControls.thermometerVisible).toBe(false);
  });
});
