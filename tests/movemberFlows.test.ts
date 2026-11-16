import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignService, type StateStore } from '../src/extension/services/campaignService';
import { defaults, schemas, movemberGoalChangeSchema, type Replicants, type SettingsState } from '../src/shared/models';
import { movemberDonation, movemberFixture } from './helpers/movemberFixture';

vi.mock('node:timers/promises', () => ({ setTimeout: async () => {} }));
const services: CampaignService[] = [];
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00.500Z')); });
afterEach(async () => { await Promise.all(services.splice(0).map((service) => service.disconnect())); vi.useRealTimers(); vi.unstubAllGlobals(); });

function setup() {
  const api = movemberFixture(); vi.stubGlobal('fetch', api.fetcher);
  const state = structuredClone(defaults);
  const store: StateStore = {
    get: <K extends keyof Replicants>(key: K) => structuredClone(state[key]),
    set: <K extends keyof Replicants>(key: K, value: Replicants[K]) => { schemas[key].parse(value); state[key] = structuredClone(value); },
  };
  const service = new CampaignService(store, () => {}, () => ({})); services.push(service);
  const settings: SettingsState = { ...defaults.settings, provider: 'movember', campaignId: '',
    campaignUrl: 'https://api.movember.com/v18/newsfeed/?entity_type=0&entity_id=42&filter_type=donation',
    pollingIntervalSeconds: 300, alertDurationSeconds: 2 };
  const poll = async () => { vi.setSystemTime(Date.now() + 16000); await service.refresh(); };
  const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  return { api, state, store, service, settings, poll, now };
}

describe('Movember HTTP → campaign → archive → alerts', () => {
  it('imports history without playback, handles automatic/manual alerts, edits/reset/resends, and reconnects without duplicates', async () => {
    const { api, state, service, settings, poll, now } = setup();
    api.state.donations = [movemberDonation(1)];
    await service.connect(settings);
    expect(state.donationHistory).toHaveLength(1); expect(state.currentAlert.visible).toBe(false);
    expect(state.donationLedger.campaignKey).toBe('movember:member/42/2026');
    expect(state.campaignHistory[0]).toMatchObject({ provider: 'movember', campaignUrl: settings.campaignUrl });
    // Arrives after baseline started but shares its second-resolution timestamp.
    api.state.donations.push(movemberDonation(2, now())); api.state.member.AmountRaised.originalAmount = '260';
    await poll();
    expect(state.currentAlert.donation?.donorName).toBe('Donor 2');
    expect(state.donationHistory.find((entry) => entry.donorName === 'Donor 2')?.sentCount).toBe(1);
    expect(state.campaign).toMatchObject({ raised: 260, percent: 26 });
    await poll(); expect(state.donationHistory).toHaveLength(2); expect(state.currentAlert.queued).toBe(0);
    service.alerts.stop(); service.setManualAlertControl({ manual: true });
    api.state.donations.push(movemberDonation(3, now())); api.state.member.AmountRaised.originalAmount = '270';
    await poll();
    const entry = state.donationHistory.find((item) => item.donorName === 'Donor 3')!;
    expect(entry.sentCount).toBe(0); expect(state.currentAlert.visible).toBe(false); expect(state.campaign.percent).toBe(27);
    service.editDonation({ entryId: entry.id, donorName: 'Edited name', message: 'Edited message' });
    service.sendDonation({ entryId: entry.id }); service.sendDonation({ entryId: entry.id });
    expect(state.currentAlert.donation).toMatchObject({ donorName: 'Edited name', message: 'Edited message' });
    await vi.advanceTimersByTimeAsync(2900);
    expect(state.donationHistory.find((item) => item.id === entry.id)?.sentCount).toBe(2);
    service.resetDonation({ entryId: entry.id });
    expect(state.donationHistory.find((item) => item.id === entry.id)).toMatchObject({ donorName: 'Donor 3', editedAt: null, sentCount: 2 });
    const saved = structuredClone(state.donationHistory); await service.disconnect();
    await service.connect({ ...settings, campaignUrl: '', campaignId: '42' });
    expect(state.donationHistory).toEqual(saved); expect(state.currentAlert.visible).toBe(false);
    expect(state.campaignHistory).toHaveLength(1);
    expect(state.campaignHistory[0]).toMatchObject({ key: 'movember:member/42/2026', campaignId: '42' });
    service.setManualAlertControl({ manual: false });
    api.state.donations.push(movemberDonation(4, now())); await poll();
    expect(state.currentAlert.donation?.donorName).toBe('Donor 4');
  });

  it('commits nothing from a failed second page and catches up after Retry-After', async () => {
    const { api, state, service, settings } = setup();
    await service.connect(settings); service.setManualAlertControl({ manual: true });
    vi.setSystemTime(new Date('2026-11-16T12:10:00Z'));
    api.state.donations = Array.from({ length: 65 }, (_, i) => movemberDonation(i + 1,
      new Date(Date.UTC(2026, 10, 16, 12, 1, i)).toISOString().slice(0, 19).replace('T', ' ')));
    api.state.member.AmountRaised.originalAmount = '900';
    api.state.error = { path: '/newsfeed', status: 429, page: 2, retryAfter: '600' };
    await expect(service.refresh()).rejects.toMatchObject({ retryable: true, retryAfterMs: 600000 });
    expect(state.donationHistory).toEqual([]); expect(state.donationLedger.seenIds).toEqual([]);
    expect(state.campaign.raised).toBe(250); expect(state.campaign.connected).toBe(false); expect(state.currentAlert.visible).toBe(false);
    api.state.error = null; vi.setSystemTime(Date.parse(state.connectionStatus.nextRetryAt!) + 1);
    await service.refresh();
    expect(state.donationHistory).toHaveLength(65); expect(state.campaign).toMatchObject({ raised: 900, percent: 90, connected: true });
    expect(state.donationHistory.every((item) => item.sentCount === 0)).toBe(true);
  });

  it('rejects an unpageable burst without committing a partial archive or thermometer total', async () => {
    const { api, state, service, settings, poll, now } = setup();
    await service.connect(settings);
    api.state.donations = Array.from({ length: 105 }, (_, i) => movemberDonation(i + 1, now()));
    api.state.member.AmountRaised.originalAmount = '1300';
    await expect(poll()).rejects.toThrow('same timestamp');
    expect(state.donationHistory).toEqual([]); expect(state.campaign.raised).toBe(250); expect(state.currentAlert.visible).toBe(false);
  });

  it('scopes a new fundraising year separately and preserves the previous archive', async () => {
    const { api, state, service, settings } = setup();
    api.state.donations = [movemberDonation(1)]; await service.connect(settings); await service.disconnect();
    vi.setSystemTime(new Date('2027-01-02T12:00:00Z'));
    api.state.configuration.campaign.current = { year: '2027', campaignStart: '2027-01-01 08:00:00', campaignEnd: '2028-01-01 07:59:59' };
    api.state.donations.unshift(movemberDonation(2, '2027-01-02 10:00:00'));
    await service.connect(settings);
    expect(state.donationHistory.map((entry) => entry.campaignKey)).toEqual(['movember:member/42/2026', 'movember:member/42/2027']);
    expect(state.donationLedger.campaignKey).toBe('movember:member/42/2027');
    expect(state.campaignHistory).toHaveLength(2); expect(state.currentAlert.visible).toBe(false);
  });

  it('enforces a 15-second refresh minimum and the existing provider-switch safeguard', async () => {
    const { service, settings, state } = setup();
    await expect(service.connect({ ...settings, pollingIntervalSeconds: 10 })).rejects.toThrow('at least 15');
    await service.connect(settings);
    expect(() => service.saveSettings({ pollingIntervalSeconds: 10, alertDurationSeconds: 6 })).toThrow('at least 15');
    await expect(service.connect(defaults.settings)).rejects.toThrow('Disconnect Movember');
    expect(state.connectionStatus.provider).toBe('movember');
  });
});


describe('Movember custom fundraising goals', () => {
  const target = { campaignId: 'member/42/2026', currency: 'USD' };

  it('updates the shared campaign immediately, survives polling, and resets to the latest API goal', async () => {
    const { api, state, service, settings, poll } = setup();
    api.state.donations = [movemberDonation(1)];
    await service.connect(settings);
    const archive = structuredClone(state.donationHistory);
    service.setMovemberGoal({ ...target, goal: 500.5 });
    expect(state.campaign).toMatchObject({ raised: 250, goal: 500.5, percent: 49.95, goalOverridden: true });
    api.state.member.targetAmount = '2000'; api.state.member.AmountRaised.originalAmount = '300';
    await poll();
    expect(state.campaign).toMatchObject({ raised: 300, goal: 500.5, percent: 59.94, goalOverridden: true });
    expect(api.state.member.targetAmount).toBe('2000');
    service.setMovemberGoal({ ...target, goal: null });
    expect(state.campaign).toMatchObject({ raised: 300, goal: 2000, percent: 15, goalOverridden: false });
    expect(state.movemberGoalOverrides).toEqual([]);
    expect(state.donationHistory).toEqual(archive); expect(state.currentAlert.visible).toBe(false);
    api.state.member.targetAmount = '0'; await poll();
    service.setMovemberGoal({ ...target, goal: 100 });
    expect(state.campaign.percent).toBe(300);
    service.setMovemberGoal({ ...target, goal: null });
    expect(state.campaign).toMatchObject({ goal: 0, percent: 0, goalOverridden: false });
  });

  it('retains overrides across service restart and reconnect, without applying them to another currency/year/provider', async () => {
    const { api, state, store, service, settings } = setup();
    await service.connect(settings); service.setMovemberGoal({ ...target, goal: 500 }); await service.disconnect();
    const restarted = new CampaignService(store, () => {}, () => ({})); services.push(restarted);
    await restarted.connect({ ...settings, campaignUrl: '', campaignId: '42' });
    expect(state.campaign).toMatchObject({ goal: 500, goalOverridden: true });
    await restarted.disconnect();
    await restarted.connect(defaults.settings);
    expect(state.campaign.goal).toBe(defaults.mockState.campaign.goal);
    expect(state.campaign.goalOverridden).not.toBe(true);
    await restarted.disconnect();
    api.state.member.currencyCode = 'CAD'; api.state.member.AmountRaised.originalCurrencyCode = 'CAD';
    await restarted.connect(settings);
    expect(state.campaign).toMatchObject({ goal: 1000, goalOverridden: false });
    await restarted.disconnect();
    api.state.member.currencyCode = 'USD'; api.state.member.AmountRaised.originalCurrencyCode = 'USD';
    api.state.configuration.campaign.current = { year: '2027', campaignStart: '2027-01-01 08:00:00', campaignEnd: '2028-01-01 07:59:59' };
    vi.setSystemTime(new Date('2027-01-02T12:00:00Z'));
    await restarted.connect(settings);
    expect(state.campaign).toMatchObject({ id: 'member/42/2027', goal: 1000, goalOverridden: false });
    expect(state.movemberGoalOverrides).toEqual([{ ...target, goal: 500 }]);
  });

  it('rejects disconnected, non-Movember, stale-campaign and malformed requests', async () => {
    const { service, settings, state } = setup();
    expect(() => service.setMovemberGoal({ ...target, goal: 500 })).toThrow('Connect a Movember');
    await service.connect(defaults.settings);
    expect(() => service.setMovemberGoal({ ...target, goal: 500 })).toThrow('Connect a Movember');
    await service.disconnect(); await service.connect(settings);
    expect(() => service.setMovemberGoal({ ...target, campaignId: 'member/43/2026', goal: 500 })).toThrow('campaign changed');
    expect(() => service.setMovemberGoal({ ...target, currency: 'CAD', goal: 500 })).toThrow('campaign changed');
    for (const goal of [0, -1, NaN, Infinity, 1e12 + 1, '', '500']) {
      expect(movemberGoalChangeSchema.safeParse({ ...target, goal }).success).toBe(false);
    }
    expect(state.movemberGoalOverrides).toEqual([]);
    expect(state.campaign.goal).toBe(1000);
  });
});
