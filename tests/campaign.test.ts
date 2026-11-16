import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampaignService, type StateStore } from '../src/extension/services/campaignService';
import { defaults, DEFAULT_ANIMATION_OUT_MS, type Replicants } from '../src/shared/models';
import { GoFundMeProProvider } from '../src/extension/providers/GoFundMeProProvider';
import { DonorDriveProvider } from '../src/extension/providers/DonorDriveProvider';
import { MockProvider } from '../src/extension/providers/MockProvider';

function setup(initial = structuredClone(defaults)) {
  const state = initial;
  const store: StateStore = {
    get: <K extends keyof Replicants>(key: K) => structuredClone(state[key]),
    set: <K extends keyof Replicants>(key: K, value: Replicants[K]) => { state[key] = structuredClone(value); },
  };
  const service = new CampaignService(store, () => {}, () => ({}));
  return { state, service };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('campaign orchestration', () => {
  it('loads ten unsent demo donations once and preserves sample edits and sends through reconnect and reset', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    expect(state.donationHistory).toHaveLength(10);
    expect(state.donationHistory.every((entry) => entry.donation.test && entry.message && entry.sentCount === 0)).toBe(true);
    expect(new Set(state.donationHistory.map((entry) => entry.donation.id)).size).toBe(10);
    expect(state.currentAlert).toMatchObject({ visible: false, donation: null, queued: 0 });
    expect(state.campaign.raised).toBe(12500);
    expect(state.campaign.percent).toBe(50);
    const original = structuredClone(state.donationHistory);
    await service.refresh();
    await service.connect(defaults.settings);
    expect(state.donationHistory).toEqual(original);
    const entry = state.donationHistory[0];
    service.editDonation({ entryId: entry.id, donorName: 'Edited demo donor', message: 'Edited demo message' });
    service.sendDonation({ entryId: entry.id });
    expect(state.currentAlert.donation).toMatchObject({ donorName: 'Edited demo donor', message: 'Edited demo message', test: true });
    expect(state.donationHistory[0].sentCount).toBe(1);
    const editedHistory = structuredClone(state.donationHistory);
    await service.resetMock();
    expect(state.donationHistory).toEqual(editedHistory);
    expect(state.recentDonations).toHaveLength(10);
    expect(state.currentAlert).toMatchObject({ visible: false, donation: null, queued: 0 });
    await service.disconnect();
  });

  it('adds demo samples to older saved demo sessions without replacing their donations or totals', async () => {
    vi.useFakeTimers();
    const initial = structuredClone(defaults);
    const existing = { id: 'mock-existing', donorName: 'Existing donor', amount: 25, currency: 'USD', anonymous: false, test: true, timestamp: '2026-10-01T12:00:00Z' };
    initial.mockState.donations = [existing];
    initial.mockState.campaign.raised = 12525;
    const { state, service } = setup(initial);
    await service.connect(defaults.settings);
    expect(state.donationHistory).toHaveLength(11);
    expect(state.mockState.donations).toContainEqual(existing);
    expect(state.campaign.raised).toBe(12525);
    expect(state.currentAlert.visible).toBe(false);
    await service.disconnect();
  });

  it('stops pending playback on a provider error without losing donation history or counting hidden alerts', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'On screen', amount: 10 });
    await service.addMockDonation({ donorName: 'Waiting', amount: 20 });
    expect(state.currentAlert.queued).toBe(1);
    const savedHistory = structuredClone(state.donationHistory);
    vi.spyOn(MockProvider.prototype, 'getCampaign').mockRejectedValueOnce(new Error('Provider unavailable'));
    await expect(service.refresh()).rejects.toThrow('Provider unavailable');
    expect(state.connectionStatus.state).toBe('error');
    expect(state.campaign.connected).toBe(false);
    expect(state.currentAlert).toMatchObject({ visible: false, donation: null, queued: 0 });
    await vi.advanceTimersByTimeAsync(7000);
    expect(state.donationHistory).toEqual(savedHistory);
    await service.disconnect();
  });

  it('allows explicit disconnected tests without using a saved campaign currency or changing donations', () => {
    const initial = structuredClone(defaults);
    initial.campaign.currency = 'CAD';
    initial.campaign.raised = 500;
    const { state, service } = setup(initial);
    service.testAlert();
    expect(state.currentAlert.donation).toMatchObject({ test: true, currency: 'USD', amount: 25 });
    expect(state.currentAlert.entryId).toBeNull();
    expect(state.donationHistory).toEqual([]);
    expect(state.campaign.raised).toBe(500);
    service.alerts.stop();
  });

  it('reads the current credentials on each Pro connection without a restart', async () => {
    vi.useFakeTimers();
    const state = structuredClone(defaults);
    let current = { clientId: 'first-id', clientSecret: 'first-secret' };
    const resolveCredentials = vi.fn(() => ({ ...current }));
    const store: StateStore = {
      get: <K extends keyof Replicants>(key: K) => structuredClone(state[key]),
      set: <K extends keyof Replicants>(key: K, value: Replicants[K]) => { state[key] = structuredClone(value); },
    };
    // Prevent external requests; this test verifies the service's credential lifecycle.
    vi.spyOn(GoFundMeProProvider.prototype, 'connect').mockResolvedValue(undefined);
    vi.spyOn(GoFundMeProProvider.prototype, 'getCampaign').mockResolvedValue({ ...defaults.mockState.campaign, connected: true });
    vi.spyOn(GoFundMeProProvider.prototype, 'getRecentDonations').mockResolvedValue([]);
    const service = new CampaignService(store, () => {}, resolveCredentials);
    const proSettings = { ...defaults.settings, provider: 'gofundme-pro' as const, campaignId: '123' };
    await service.connect(proSettings);
    current = { clientId: 'second-id', clientSecret: 'second-secret' };
    await service.connect(proSettings);
    expect(resolveCredentials.mock.results.map((result) => result.value.clientId)).toEqual(['first-id', 'second-id']);
    expect(JSON.stringify(state)).not.toContain('secret');
    await service.disconnect();
  });
  it('runs the full mock workflow and keeps alert-only tests separate from totals', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    expect(state.campaign.percent).toBe(50); expect(state.currentAlert.visible).toBe(false);
    await service.addMockDonation({ donorName: 'Rob', amount: 50 });
    expect(state.campaign.raised).toBe(12550);
    expect(state.currentAlert.donation?.donorName).toBe('Rob');
    service.testAlert(); service.testAlert();
    expect(state.currentAlert.queued).toBe(2); expect(state.campaign.raised).toBe(12550);
    expect(state.recentDonations).toHaveLength(11);
    await service.disconnect(); expect(state.campaign.raised).toBe(12550); expect(state.currentAlert.visible).toBe(false);
  });
  it('does not replay held donations on reconnect or when switching back to automatic control', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    service.setManualAlertControl({ manual: true });
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'Quiet donor', amount: 10 });
    expect(state.currentAlert.visible).toBe(false);
    service.setManualAlertControl({ manual: false });
    await service.refresh(); expect(state.currentAlert.visible).toBe(false);
    await service.disconnect();
    const restarted = setup(structuredClone(state));
    await restarted.service.connect(defaults.settings);
    expect(restarted.state.currentAlert.visible).toBe(false);
    expect(restarted.state.recentDonations).toHaveLength(11);
    await restarted.service.disconnect();
  });
  it('rejects unsupported Pro campaigns while preserving the previous thermometer', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    await service.disconnect();
    await expect(service.connect({ ...defaults.settings, provider: 'gofundme-pro', campaignId: '123', campaignUrl: 'https://www.gofundme.com/f/consumer' })).rejects.toThrow('Ordinary GoFundMe');
    expect(state.connectionStatus.state).toBe('error'); expect(state.campaign.raised).toBe(12500);
    expect(state.campaign.connected).toBe(false); expect(state.currentAlert.visible).toBe(false);
    await service.disconnect();
  });
  it('requires an explicit disconnect before switching, preserving the active provider and alerts', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'Still live', amount: 12 });
    const before = structuredClone(state);
    await expect(service.connect({ ...defaults.settings, provider: 'donordrive' })).rejects.toThrow('Disconnect Mock / Demo before switching to DonorDrive');
    expect(state).toEqual(before);
    await service.refresh();
    expect(state.connectionStatus.state).toBe('connected');
    await service.disconnect();
    await expect(service.connect({ ...defaults.settings, provider: 'donordrive' })).rejects.toThrow('DonorDrive fundraising page');
    // Even a failed provider session must be disconnected before changing providers.
    await expect(service.connect(defaults.settings)).rejects.toThrow('Disconnect DonorDrive');
    await service.disconnect();
  });
  it('connects DonorDrive through the shared alert pipeline and enforces its refresh interval', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    const time = new Date().toISOString();
    const settings = { ...defaults.settings, provider: 'donordrive' as const, campaignId: '123', campaignUrl: 'https://charity.donordrive.com/' };
    vi.spyOn(DonorDriveProvider.prototype, 'connect').mockResolvedValue();
    vi.spyOn(DonorDriveProvider.prototype, 'getCampaign').mockResolvedValue({ ...defaults.mockState.campaign, id: 'participants/123', connected: true });
    const donations = vi.spyOn(DonorDriveProvider.prototype, 'getRecentDonations').mockResolvedValue([]);
    await expect(service.connect({ ...settings, pollingIntervalSeconds: 10 })).rejects.toThrow('at least 15');
    await service.connect(settings);
    expect(state.connectionStatus.provider).toBe('donordrive');
    expect(state.donationLedger.campaignKey).toBe('donordrive:https://charity.donordrive.com:participants/123');
    expect(state.currentAlert.visible).toBe(false);
    expect(() => service.saveSettings({ pollingIntervalSeconds: 10, alertDurationSeconds: 6 })).toThrow('at least 15');
    donations.mockResolvedValue([{ id: 'dd-new', amount: 15, currency: 'CAD', donorName: 'Anonymous', anonymous: true, timestamp: time }]);
    await service.refresh();
    expect(state.currentAlert.donation?.id).toBe('dd-new');
    await service.refresh();
    expect(state.currentAlert.queued).toBe(0);
    await service.disconnect();
  });
  it('reset clears the queue and restores demo totals without replay', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'First', amount: 10 });
    await service.addMockDonation({ donorName: 'Second', amount: 20 });
    expect(state.currentAlert.queued).toBe(1);
    await service.resetMock();
    expect(state.campaign.raised).toBe(12500); expect(state.currentAlert.donation).toBeNull();
    expect(state.recentDonations).toHaveLength(10);
    await service.disconnect();
  });
  it('resends an already-alerted donation repeatedly in order without changing totals, history, or dedupe', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'Replay donor', amount: 25, message: '  Keep going!  ' });
    expect(state.currentAlert.donation?.message).toBe('Keep going!');
    const original = structuredClone(state.recentDonations[0]);
    const before = structuredClone({ campaign: state.campaign, history: state.recentDonations, ledger: state.donationLedger });
    service.resendDonation({ donationId: original.id });
    service.resendDonation({ donationId: original.id });
    expect(state.currentAlert.donation?.id).toBe(original.id);
    expect(state.currentAlert.queued).toBe(2);
    service.alerts.dismiss(); await vi.advanceTimersByTimeAsync(DEFAULT_ANIMATION_OUT_MS);
    const firstReplay = structuredClone(state.currentAlert.donation!);
    expect(firstReplay.id).not.toBe(original.id);
    expect({ ...firstReplay, id: original.id }).toEqual(original);
    service.alerts.dismiss(); await vi.advanceTimersByTimeAsync(DEFAULT_ANIMATION_OUT_MS);
    expect(state.currentAlert.donation?.id).not.toBe(firstReplay.id);
    expect(state.currentAlert.donation?.test).toBe(true);
    expect({ campaign: state.campaign, history: state.recentDonations, ledger: state.donationLedger }).toEqual(before);
    await service.refresh();
    expect(state.currentAlert.queued).toBe(0);
    expect(state.donationLedger).toEqual(before.ledger);
    await service.disconnect();
  });
  it('resends public history while disconnected, preserving anonymity, currency, and the real donation flag', () => {
    vi.useFakeTimers();
    const initial = structuredClone(defaults);
    initial.recentDonations = [{ id: 'real-donation', donorName: 'Anonymous', amount: 12.5, currency: 'CAD', anonymous: true, timestamp: '2026-10-11T12:00:00Z' }];
    const { state, service } = setup(initial);
    service.resendDonation({ donationId: 'real-donation' });
    expect(state.currentAlert.donation).toMatchObject({ donorName: 'Anonymous', amount: 12.5, currency: 'CAD', anonymous: true });
    expect(state.currentAlert.donation?.test).toBeUndefined();
    expect(state.currentAlert.visible).toBe(true);
    expect(state.recentDonations).toHaveLength(1);
    service.alerts.stop();
  });
  it('rejects missing donations without altering the queue', () => {
    vi.useFakeTimers();
    const initial = structuredClone(defaults);
    initial.recentDonations = [{ id: 'known', donorName: 'Anonymous', amount: 10, currency: 'USD', anonymous: true, timestamp: '2026-10-11T12:00:00Z' }];
    const { state, service } = setup(initial);
    expect(() => service.resendDonation({ donationId: 'gone' })).toThrow('no longer in recent donations');
    expect(state.currentAlert).toEqual(defaults.currentAlert);
  });

  it.each([false, true])('ignores the retired disabled setting while preserving manual mode %s', async (manual) => {
    vi.useFakeTimers();
    const initial = structuredClone(defaults);
    initial.settings = { ...initial.settings, alertsEnabled: false, pollingIntervalSeconds: 20, alertDurationSeconds: 8 };
    initial.donationControl.manual = manual;
    const legacySettings = structuredClone(initial.settings);
    const { state, service } = setup(initial);
    expect(state.settings).toEqual({ ...legacySettings, alertsEnabled: true });
    expect(state.donationControl.manual).toBe(manual);
    // An older open dashboard can still send alertsEnabled: false on connect.
    await service.connect(legacySettings);
    await service.addMockDonation({ donorName: 'Migrated donor', amount: 10 });
    expect(state.settings.alertsEnabled).toBe(true);
    expect(state.currentAlert.visible).toBe(!manual);
    expect(state.donationHistory.at(-1)!.sentCount).toBe(manual ? 0 : 1);
    if (manual) {
      service.sendDonation({ entryId: state.donationHistory.at(-1)!.id });
      expect(state.currentAlert.visible).toBe(true);
      expect(state.donationHistory.at(-1)!.sentCount).toBe(1);
    }
    service.alerts.stop();
    service.testAlert();
    expect(state.currentAlert.donation).toMatchObject({ test: true, donorName: 'Alex Morgan' });
    expect(state.donationHistory).toHaveLength(11);
    await service.disconnect();
  });

  it('saving timing never clears playback or changes delivery mode, including old client payloads', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'Current donation', amount: 10 });
    await service.addMockDonation({ donorName: 'Pending donation', amount: 20 });
    const playback = structuredClone(state.currentAlert);
    const legacyPayload = { pollingIntervalSeconds: 20, alertDurationSeconds: 8, alertsEnabled: false };
    service.saveSettings(legacyPayload);
    expect(state.settings).toMatchObject({ pollingIntervalSeconds: 20, alertDurationSeconds: 8, alertsEnabled: true });
    expect(state.currentAlert).toEqual(playback);
    expect(state.donationControl.manual).toBe(false);
    service.setManualAlertControl({ manual: true });
    service.saveSettings({ pollingIntervalSeconds: 15, alertDurationSeconds: 6 });
    expect(state.donationControl.manual).toBe(true);
    expect(state.currentAlert.visible).toBe(true);
    await service.disconnect();
  });
});
