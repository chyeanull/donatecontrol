import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampaignService, type StateStore } from '../src/extension/services/campaignService';
import { DonationHistory } from '../src/extension/services/donationHistory';
import { defaults, DEFAULT_ANIMATION_IN_MS, DEFAULT_ANIMATION_OUT_MS, schemas, type Donation, type Replicants } from '../src/shared/models';

function setup(initial = structuredClone(defaults)) {
  const state = initial;
  const store: StateStore = {
    get: <K extends keyof Replicants>(key: K) => structuredClone(state[key]),
    set: <K extends keyof Replicants>(key: K, value: Replicants[K]) => {
      schemas[key].parse(value);
      state[key] = structuredClone(value);
    },
  };
  const service = new CampaignService(store, () => {}, () => ({}));
  return { state, service, history: new DonationHistory(store) };
}
const donation = (id: string): Donation => ({ id, donorName: 'Original donor', amount: 50, currency: 'USD', anonymous: false,
  message: 'Original message', timestamp: '2026-11-01T12:00:00Z' });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('persistent donation list and manual alert control', () => {
  it('holds manual arrivals and counts each send only when its playback starts', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    service.setManualAlertControl({ manual: true });
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'Held donation', amount: 12, message: 'Waiting for the producer' });
    const entry = state.donationHistory[0];
    expect(state.campaign.raised).toBe(12512);
    expect(entry.sentCount).toBe(0);
    expect(state.currentAlert.visible).toBe(false);
    expect(state.currentAlert.queued).toBe(0);
    service.sendDonation({ entryId: entry.id });
    service.sendDonation({ entryId: entry.id });
    expect(state.donationHistory[0].sentCount).toBe(1);
    expect(state.currentAlert.queuedEntryIds).toEqual([entry.id]);
    service.alerts.dismiss();
    await vi.advanceTimersByTimeAsync(DEFAULT_ANIMATION_OUT_MS);
    expect(state.donationHistory[0].sentCount).toBe(2);
    expect(state.donationHistory[0].lastSentAt).toBeTruthy();
    expect(state.campaign.raised).toBe(12512);
    expect(state.donationHistory).toHaveLength(1);
    await service.disconnect();
  });

  it('resumes automatic delivery for future arrivals without releasing held donations', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    service.setManualAlertControl({ manual: true });
    await service.addMockDonation({ donorName: 'Held', amount: 10 });
    service.setManualAlertControl({ manual: false });
    await service.refresh();
    expect(state.currentAlert.visible).toBe(false);
    // The durable archive also guards against IDs aging out of the bounded ledger.
    state.donationLedger.seenIds = [];
    await service.refresh();
    expect(state.currentAlert.visible).toBe(false);
    await service.addMockDonation({ donorName: 'Automatic', amount: 20 });
    expect(state.currentAlert.donation?.donorName).toBe('Automatic');
    expect(state.donationHistory.map((item) => item.sentCount)).toEqual([0, 1]);
    await service.refresh();
    expect(state.donationHistory.map((item) => item.sentCount)).toEqual([0, 1]);
    await service.disconnect();
  });

  it('enabling manual control holds pending alerts and lets the current alert finish', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'On screen', amount: 10 });
    await service.addMockDonation({ donorName: 'Pending', amount: 20 });
    expect(state.currentAlert.queued).toBe(1);
    expect(state.donationHistory.map((item) => item.sentCount)).toEqual([1, 0]);
    service.setManualAlertControl({ manual: true });
    expect(state.currentAlert.visible).toBe(true);
    expect(state.currentAlert.queued).toBe(0);
    await vi.advanceTimersByTimeAsync(6000 + DEFAULT_ANIMATION_IN_MS + DEFAULT_ANIMATION_OUT_MS);
    expect(state.currentAlert.visible).toBe(false);
    expect(state.donationHistory.map((item) => item.sentCount)).toEqual([1, 0]);
    await service.disconnect();
  });

  it('saves edits without changing source data, and applies edits to pending and future alerts', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'Original donor', amount: 50, message: 'Original message' });
    const entry = structuredClone(state.donationHistory[0]);
    const original = structuredClone(state.recentDonations);
    service.sendDonation({ entryId: entry.id });
    service.editDonation({ entryId: entry.id, donorName: '  Edited donor  ', message: '  Edited message  ' });
    expect(state.currentAlert.donation?.donorName).toBe('Original donor');
    expect(state.donationHistory[0]).toMatchObject({ donorName: 'Edited donor', message: 'Edited message', donation: entry.donation });
    service.alerts.dismiss(); await vi.advanceTimersByTimeAsync(DEFAULT_ANIMATION_OUT_MS);
    expect(state.currentAlert.donation).toMatchObject({ donorName: 'Edited donor', message: 'Edited message', amount: 50, test: true });
    await service.refresh();
    expect(state.donationHistory[0].donorName).toBe('Edited donor');
    expect(state.recentDonations).toEqual(original);
    expect(state.campaign.raised).toBe(12550);
    await service.disconnect();
  });

  it('retains manual mode, original content, edits and counts after restart without replaying', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    service.setManualAlertControl({ manual: true });
    await service.addMockDonation({ donorName: 'Persistent donor', amount: 10, message: 'Keep this' });
    const id = state.donationHistory[0].id;
    service.editDonation({ entryId: id, donorName: 'Saved name', message: 'Saved text' });
    service.sendDonation({ entryId: id });
    await service.disconnect();
    const saved = JSON.parse(JSON.stringify(state)) as Replicants;
    const restarted = setup(saved);
    await restarted.service.connect(defaults.settings);
    expect(restarted.state.donationControl.manual).toBe(true);
    expect(restarted.state.currentAlert.visible).toBe(false);
    expect(restarted.state.donationHistory).toEqual(state.donationHistory);
    restarted.service.sendDonation({ entryId: id });
    expect(restarted.state.currentAlert.donation).toMatchObject({ donorName: 'Saved name', message: 'Saved text' });
    expect(restarted.state.donationHistory[0].sentCount).toBe(2);
    await restarted.service.disconnect();
  });

  it('resets edited text in queued and future alerts without changing an active alert, original data or send counts', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    service.setManualAlertControl({ manual: true });
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'Original name', amount: 50, message: 'Original text' });
    const entry = structuredClone(state.donationHistory[0]);
    service.editDonation({ entryId: entry.id, donorName: 'Edited name', message: 'Edited text' });
    service.sendDonation({ entryId: entry.id });
    service.sendDonation({ entryId: entry.id });
    service.resetDonation({ entryId: entry.id });
    expect(state.donationHistory[0]).toMatchObject({ donorName: 'Original name', message: 'Original text', editedAt: null, sentCount: 1, donation: entry.donation });
    expect(state.currentAlert.donation?.donorName).toBe('Edited name');
    expect(state.campaign.raised).toBe(12550);
    service.alerts.dismiss(); await vi.advanceTimersByTimeAsync(DEFAULT_ANIMATION_OUT_MS);
    expect(state.currentAlert.donation).toMatchObject({ donorName: 'Original name', message: 'Original text' });
    expect(state.donationHistory[0].sentCount).toBe(2);
    await service.disconnect();
    const restarted = setup(JSON.parse(JSON.stringify(state)) as Replicants);
    expect(restarted.state.donationHistory).toEqual(state.donationHistory);
    expect(restarted.state.donationHistory[0].editedAt).toBeNull();
  });

  it('marks only changed content as edited and restores originals without applying manual-edit limits', () => {
    const { state, history, service } = setup();
    const original = { ...donation('long-original'), donorName: 'A'.repeat(250), message: undefined };
    history.capture([original], 'mock:demo', 'Demo');
    const entryId = state.donationHistory[0].id;
    service.editDonation({ entryId, donorName: 'Edited', message: 'Added message' });
    expect(state.donationHistory[0].editedAt).not.toBeNull();
    service.resetDonation({ entryId });
    expect(state.donationHistory[0]).toMatchObject({ donorName: original.donorName, message: '', editedAt: null, sentCount: 0 });
    history.capture([donation('normal')], 'mock:demo', 'Demo');
    const normalId = state.donationHistory[1].id;
    service.editDonation({ entryId: normalId, donorName: 'Original donor', message: 'Original message' });
    expect(state.donationHistory[1].editedAt).toBeNull();
    service.editDonation({ entryId: normalId, donorName: 'Different', message: 'Different' });
    service.editDonation({ entryId: normalId, donorName: 'Original donor', message: 'Original message' });
    expect(state.donationHistory[1].editedAt).toBeNull();
  });

  it('retains all received records beyond the old 50-item window and isolates identical campaign IDs', () => {
    const { state, history } = setup();
    const entries = Array.from({ length: 80 }, (_, index) => donation(String(index)));
    history.capture(entries, 'provider:first', 'First campaign');
    history.capture([entries[0], donation('new')], 'provider:first', 'First campaign');
    history.capture([entries[0]], 'provider:second', 'Second campaign');
    expect(state.donationHistory).toHaveLength(82);
    const first = state.donationHistory[0];
    history.edit({ entryId: first.id, donorName: 'Edited', message: '' });
    history.capture(entries, 'provider:first', 'First campaign');
    expect(state.donationHistory).toHaveLength(82);
    expect(state.donationHistory[0].donorName).toBe('Edited');
    expect(state.donationHistory[81].donorName).toBe('Original donor');
  });

  it('imports existing history once and does not fabricate previous send counts', () => {
    const initial = structuredClone(defaults);
    initial.recentDonations = [donation('old')];
    initial.mockState.donations = [donation('old'), donation('older')];
    const { state } = setup(initial);
    expect(state.donationHistory).toHaveLength(2);
    expect(state.donationHistory.map((entry) => entry.sentCount)).toEqual([0, 0]);
    expect(setup(structuredClone(state)).state.donationHistory).toEqual(state.donationHistory);
  });

  it('preserves the archive in manual mode, when demo state resets or playback is cleared', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    service.setManualAlertControl({ manual: true });
    await service.connect(defaults.settings);
    await service.addMockDonation({ donorName: 'Saved while held', amount: 10 });
    const id = state.donationHistory[0].id;
    expect(state.donationHistory[0].sentCount).toBe(0);
    service.sendDonation({ entryId: id }); service.sendDonation({ entryId: id });
    service.alerts.clear();
    expect(state.donationHistory[0].sentCount).toBe(1);
    await service.resetMock();
    expect(state.donationHistory).toHaveLength(1);
    expect(state.donationHistory[0].sentCount).toBe(1);
    expect(state.currentAlert.donation).toBeNull();
    await service.disconnect();
  });

  it('validates edits server-side and rejects unknown records without altering stored data', () => {
    const { state, history, service } = setup();
    history.capture([donation('known')], 'mock:demo', 'Demo');
    const before = structuredClone(state.donationHistory);
    const entryId = before[0].id;
    expect(() => service.editDonation({ entryId, donorName: ' ', message: '' })).toThrow('donor name');
    expect(() => service.editDonation({ entryId, donorName: 'a'.repeat(201), message: '' })).toThrow('donor name');
    expect(() => service.editDonation({ entryId, donorName: 'Valid', message: 'a'.repeat(2001) })).toThrow('2,000');
    expect(() => service.editDonation({ entryId: 'missing', donorName: 'Valid', message: '' })).toThrow('could not be found');
    expect(() => service.sendDonation({ entryId: 'missing' })).toThrow('could not be found');
    expect(() => service.resetDonation({ entryId: 'missing' })).toThrow('could not be found');
    expect(state.donationHistory).toEqual(before);
  });
});
