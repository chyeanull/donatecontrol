import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampaignService, type StateStore } from '../src/extension/services/campaignService';
import { defaults, schemas, type ProviderConfig, type Replicants } from '../src/shared/models';
import { MockProvider } from '../src/extension/providers/MockProvider';
import { GoFundMeProProvider } from '../src/extension/providers/GoFundMeProProvider';
import { DonorDriveProvider } from '../src/extension/providers/DonorDriveProvider';
import { GivebutterProvider } from '../src/extension/providers/GivebutterProvider';

function setup(state = structuredClone(defaults)) {
  const store: StateStore = {
    get: <K extends keyof Replicants>(key: K) => structuredClone(state[key]),
    set: <K extends keyof Replicants>(key: K, value: Replicants[K]) => {
      schemas[key].parse(value);
      state[key] = structuredClone(value);
    },
  };
  return { state, service: new CampaignService(store, () => {}, () => ({})) };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('saved campaign connections', () => {
  it('records successful connections once, leaves dates unchanged on polling, and survives restart', async () => {
    vi.useFakeTimers();
    const { state, service } = setup();
    await service.connect(defaults.settings);
    const saved = structuredClone(state.campaignHistory);
    expect(saved).toEqual([expect.objectContaining({ key: 'mock:demo', title: 'Charity Stream', provider: 'mock' })]);
    vi.setSystemTime(Date.now() + 1000);
    await service.refresh();
    expect(state.campaignHistory).toEqual(saved);
    await service.disconnect();
    const restarted = setup(structuredClone(state));
    expect(restarted.state.campaignHistory).toEqual(saved);
    await restarted.service.connect(defaults.settings);
    expect(restarted.state.campaignHistory).toHaveLength(1);
    expect(restarted.state.campaignHistory[0].lastConnectedAt).not.toBe(saved[0].lastConnectedAt);
    await restarted.service.disconnect();
  });

  it('moves reconnected campaigns to the top using resolved IDs, without saving timing or credentials', async () => {
    vi.useFakeTimers();
    let current: ProviderConfig;
    vi.spyOn(GoFundMeProProvider.prototype, 'connect').mockImplementation(async (config) => { current = config; });
    vi.spyOn(GoFundMeProProvider.prototype, 'getCampaign').mockImplementation(async () => ({ ...defaults.mockState.campaign,
      id: String(Number(current.campaignId)), title: `Campaign ${Number(current.campaignId)}`, connected: true }));
    vi.spyOn(GoFundMeProProvider.prototype, 'getRecentDonations').mockResolvedValue([]);
    const { state, service } = setup();
    const settings = { ...defaults.settings, provider: 'gofundme-pro' as const, campaignUrl: 'https://www.classy.org/campaign/example' };
    await service.connect({ ...settings, campaignId: '123' });
    await service.connect({ ...settings, campaignId: '456' });
    await service.connect({ ...settings, campaignId: '00123' });
    expect(state.campaignHistory.map((entry) => entry.key)).toEqual(['gofundme-pro:123', 'gofundme-pro:456']);
    expect(state.campaignHistory[0]).toMatchObject({ campaignId: '00123', campaignUrl: settings.campaignUrl, provider: 'gofundme-pro' });
    expect(Object.keys(state.campaignHistory[0]).sort()).toEqual(['campaignId', 'campaignUrl', 'donorDriveResource', 'key', 'lastConnectedAt', 'provider', 'title']);
    await service.disconnect();
  });

  it('keeps DonorDrive sites and fundraiser types separate and retains the exact connection fields', async () => {
    vi.useFakeTimers();
    let current: ProviderConfig;
    vi.spyOn(DonorDriveProvider.prototype, 'connect').mockImplementation(async (config) => { current = config; });
    vi.spyOn(DonorDriveProvider.prototype, 'getCampaign').mockImplementation(async () => ({ ...defaults.mockState.campaign,
      id: `${current.donorDriveResource}/${current.campaignId}`, title: 'Team fundraiser', connected: true }));
    vi.spyOn(DonorDriveProvider.prototype, 'getRecentDonations').mockResolvedValue([]);
    const { state, service } = setup();
    const settings = { ...defaults.settings, provider: 'donordrive' as const, campaignId: '7' };
    await service.connect({ ...settings, campaignUrl: 'https://first.donordrive.com/', donorDriveResource: 'participants' });
    await service.connect({ ...settings, campaignUrl: 'https://first.donordrive.com/', donorDriveResource: 'teams' });
    await service.connect({ ...settings, campaignUrl: 'https://second.donordrive.com/', donorDriveResource: 'teams' });
    expect(state.campaignHistory.map((entry) => entry.key)).toEqual([
      'donordrive:https://second.donordrive.com:teams/7', 'donordrive:https://first.donordrive.com:teams/7', 'donordrive:https://first.donordrive.com:participants/7',
    ]);
    expect(state.campaignHistory[0]).toMatchObject({ provider: 'donordrive', campaignUrl: 'https://second.donordrive.com/', campaignId: '7', donorDriveResource: 'teams' });
    await service.disconnect();
  });

  it('deduplicates Givebutter URL and ID connections to the same campaign', async () => {
    vi.useFakeTimers();
    vi.spyOn(GivebutterProvider.prototype, 'connect').mockResolvedValue();
    vi.spyOn(GivebutterProvider.prototype, 'getCampaign').mockResolvedValue({ ...defaults.mockState.campaign, id: '345', connected: true });
    vi.spyOn(GivebutterProvider.prototype, 'getRecentDonations').mockResolvedValue([]);
    const { state, service } = setup();
    const settings = { ...defaults.settings, provider: 'givebutter' as const };
    await service.connect({ ...settings, campaignUrl: 'https://givebutter.com/charity-event' });
    await service.connect({ ...settings, campaignId: '345' });
    expect(state.campaignHistory).toHaveLength(1);
    expect(state.campaignHistory[0]).toMatchObject({ key: 'givebutter:345', provider: 'givebutter', campaignUrl: '', campaignId: '345' });
    await service.disconnect();
  });

  it('does not save failed or cancelled connections, including a failure after loading campaign details', async () => {
    vi.useFakeTimers();
    const donations = vi.spyOn(MockProvider.prototype, 'getRecentDonations').mockRejectedValueOnce(new Error('Donations unavailable'));
    const { state, service } = setup();
    await expect(service.connect(defaults.settings)).rejects.toThrow('Donations unavailable');
    expect(state.campaignHistory).toEqual([]);
    await service.disconnect();
    let release!: () => void;
    let started!: () => void;
    const loading = new Promise<void>((resolve) => { started = resolve; });
    donations.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve([]); started(); }));
    const pending = service.connect(defaults.settings);
    await loading;
    await service.disconnect();
    release(); await pending;
    expect(state.campaignHistory).toEqual([]);
  });
});
