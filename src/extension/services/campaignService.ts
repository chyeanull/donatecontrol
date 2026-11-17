import { randomUUID } from 'node:crypto';
import type { CampaignState, Commands, Replicants, SettingsState } from '../../shared/models';
import { providerNames } from '../../shared/models';
import { formatCurrency, percentage } from '../../shared/format';
import { ProviderError, publicError, type FundraisingProvider } from '../providers/FundraisingProvider';
import { MockProvider } from '../providers/MockProvider';
import { GoFundMeProProvider } from '../providers/GoFundMeProProvider';
import { DonorDriveProvider } from '../providers/DonorDriveProvider';
import { GivebutterProvider } from '../providers/GivebutterProvider';
import { MovemberProvider } from '../providers/MovemberProvider';
import { AlertQueue } from './alertQueue';
import { detectDonations } from './donationService';
import { DonationHistory } from './donationHistory';
import { PollingService } from './pollingService';
import type { ProCredentials } from './credentialStore';
import { resolveAlertPlayback } from '../../shared/appearance';

export interface StateStore {
  get<K extends keyof Replicants>(key: K): Replicants[K];
  set<K extends keyof Replicants>(key: K, value: Replicants[K]): void;
}
export class CampaignService {
  private provider?: FundraisingProvider;
  private poller?: PollingService;
  private generation = 0;
  private readonly mock: MockProvider;
  private readonly donorDrive = new DonorDriveProvider();
  private readonly movember = new MovemberProvider();
  private movemberCampaign?: CampaignState;
  private readonly history: DonationHistory;
  readonly alerts: AlertQueue;
  constructor(private readonly store: StateStore, private readonly log: (message: string, error?: boolean) => void,
    private readonly getCredentials: () => Partial<ProCredentials>, private readonly getGivebutterKey: () => string | undefined = () => undefined) {
    // Migrate the retired master switch without changing the saved manual/auto mode.
    store.set('settings', { ...store.get('settings'), alertsEnabled: true });
    this.mock = new MockProvider(() => store.get('mockState'), (state) => store.set('mockState', state));
    this.history = new DonationHistory(store);
    // Import the public records retained by earlier versions, once per campaign/ID.
    const savedKey = store.get('donationLedger').campaignKey || (store.get('settings').provider === 'mock' ? 'mock:demo' : `legacy:${store.get('settings').provider}`);
    this.history.capture(store.get('recentDonations'), savedKey, store.get('campaign').title);
    this.history.capture(store.get('mockState').donations, 'mock:demo', store.get('mockState').campaign.title);
    this.alerts = new AlertQueue((value) => store.set('currentAlert', value), () => store.get('settings').alertDurationSeconds,
      log, (entryId) => this.history.markSent(entryId), () => {
        return resolveAlertPlayback(store.get('overlayAppearance'), store.get('settings').alertDurationSeconds);
      });
  }
  async connect(settings: SettingsState) {
    settings = { ...settings, alertsEnabled: true };
    const active = this.store.get('connectionStatus').provider;
    if (this.provider && active !== settings.provider) {
      throw new ProviderError(`Disconnect ${providerNames[active]} before switching to ${providerNames[settings.provider]}.`);
    }
    if (['donordrive', 'movember'].includes(settings.provider) && settings.pollingIntervalSeconds < 15) {
      throw new ProviderError(`${providerNames[settings.provider]} requires a refresh interval of at least 15 seconds.`);
    }
    await this.disconnect(false);
    const session = ++this.generation;
    this.store.set('settings', settings);
    this.store.set('connectionStatus', { state: 'connecting', provider: settings.provider,
      message: 'Connecting and establishing a donation baseline…', lastSuccessfulFetch: null, nextRetryAt: null });
    const provider = settings.provider === 'mock' ? this.mock : settings.provider === 'donordrive' ? this.donorDrive
      : settings.provider === 'movember' ? this.movember
      : settings.provider === 'givebutter' ? new GivebutterProvider(this.getGivebutterKey()) : new GoFundMeProProvider(this.getCredentials());
    this.provider = provider;
    let authenticated = false;
    let baseline = true;
    const poller = new PollingService(async () => {
      // A donation can arrive while a paginated baseline is still loading. Use
      // the scan's start, so an unseen arrival is eligible on the next poll.
      // Movember timestamps have only second precision. Keep arrivals from the
      // baseline's final second eligible; known IDs still prevent replay.
      const scanStartedAt = new Date(settings.provider === 'movember' ? Math.floor(Date.now() / 1000) * 1000 : Date.now()).toISOString();
      if (!authenticated) { await provider.connect(settings); authenticated = true; }
      if (session !== this.generation) return;
      const campaign = await provider.getCampaign();
      const donations = await provider.getRecentDonations();
      if (session !== this.generation) return;
      const key = settings.provider === 'donordrive' ? `donordrive:${new URL(settings.campaignUrl).origin}:${campaign.id}`
        : `${settings.provider}:${settings.provider === 'mock' ? 'demo' : ['givebutter', 'movember'].includes(settings.provider) ? campaign.id : settings.campaignId}`;
      const result = detectDonations(donations, this.store.get('donationLedger'), key, baseline, scanStartedAt);
      // Commit the ledger before exposing any alerts. Incomplete polls commit nothing.
      this.store.set('donationLedger', result.ledger);
      if (settings.provider === 'movember') this.movemberCampaign = campaign;
      this.store.set('campaign', settings.provider === 'movember' ? this.withMovemberGoal(campaign) : campaign);
      this.store.set('recentDonations', result.recent);
      const { entries, added } = this.history.capture(donations, key, campaign.title);
      // Only complete, successful non-demo connections enter history. Polling does not
      // reorder the list or replace the time the producer last connected.
      if (baseline && settings.provider !== 'mock') {
        const historyKey = settings.provider === 'gofundme-pro' ? `gofundme-pro:${campaign.id}` : key;
        this.store.set('campaignHistory', [{
          key: historyKey, title: campaign.title, provider: settings.provider,
          campaignUrl: settings.campaignUrl, campaignId: settings.campaignId,
          donorDriveResource: settings.donorDriveResource ?? 'participants',
          lastConnectedAt: new Date().toISOString(),
        }, ...this.store.get('campaignHistory').filter((entry) => entry.key !== historyKey)]);
      }
      this.store.set('connectionStatus', { state: 'connected', provider: settings.provider,
        message: settings.provider === 'mock' ? 'Demo connected. All donations are simulated.' : `Connected to ${providerNames[settings.provider]}.`,
        lastSuccessfulFetch: campaign.lastUpdated, nextRetryAt: null });
      for (const donation of result.newDonations) {
        this.log(`Donation received: ${donation.donorName} · ${formatCurrency(donation.amount, donation.currency)}`);
        if (added.has(donation.id) && !this.store.get('donationControl').manual) {
          const entry = entries.get(donation.id)!;
          this.alerts.enqueue(this.history.content(entry), entry.id);
        }
      }
      this.log(baseline ? 'Connected to campaign · historical donations baselined' : 'Campaign refreshed');
      baseline = false;
    }, () => this.store.get('settings').pollingIntervalSeconds * 1000, (error, nextRetryAt) => {
      if (session !== this.generation) return;
      const message = publicError(error);
      this.store.set('connectionStatus', { ...this.store.get('connectionStatus'), state: 'error', message, nextRetryAt });
      this.store.set('campaign', { ...this.store.get('campaign'), connected: false });
      this.alerts.stop();
      this.log(message, true);
    });
    this.poller = poller;
    await poller.start();
  }
  async disconnect(announce = true) {
    ++this.generation;
    this.poller?.stop(); this.poller = undefined;
    const previous = this.provider; this.provider = undefined;
    this.movemberCampaign = undefined;
    await previous?.disconnect();
    this.alerts.stop();
    this.store.set('campaign', { ...this.store.get('campaign'), connected: false });
    this.store.set('connectionStatus', { ...this.store.get('connectionStatus'), state: 'disconnected',
      message: 'Disconnected. Connect a provider to show campaign data and donations.', nextRetryAt: null });
    if (announce) this.log('Disconnected from campaign');
  }
  async refresh() {
    if (!this.poller) throw new ProviderError('Connect a campaign first.');
    await this.poller.refresh();
  }
  private withMovemberGoal(campaign: CampaignState): CampaignState {
    const override = this.store.get('movemberGoalOverrides').find((entry) =>
      entry.campaignId === campaign.id && entry.currency === campaign.currency);
    const goal = override?.goal ?? campaign.goal;
    return { ...campaign, goal, percent: percentage(campaign.raised, goal), goalOverridden: Boolean(override) };
  }
  setMovemberGoal({ campaignId, currency, goal }: Commands['setMovemberGoal']) {
    const campaign = this.movemberCampaign;
    if (this.provider !== this.movember || this.store.get('connectionStatus').state !== 'connected' || !campaign) {
      throw new ProviderError('Connect a Movember campaign before changing its fundraising goal.');
    }
    if (campaign.id !== campaignId || campaign.currency !== currency) {
      throw new ProviderError('The connected campaign changed. Open Edit again to change its fundraising goal.');
    }
    const overrides = this.store.get('movemberGoalOverrides').filter((entry) =>
      entry.campaignId !== campaignId || entry.currency !== currency);
    if (goal !== null) overrides.push({ campaignId, currency, goal });
    this.store.set('movemberGoalOverrides', overrides);
    this.store.set('campaign', this.withMovemberGoal(campaign));
    this.log(goal === null ? 'Movember fundraising goal reset to the API amount'
      : `Movember fundraising goal set to ${formatCurrency(goal, currency)}`);
  }
  saveSettings(value: Commands['saveSettings']) {
    const provider = this.store.get('settings').provider;
    if (['donordrive', 'movember'].includes(provider) && value.pollingIntervalSeconds < 15) {
      throw new ProviderError(`${providerNames[provider]} requires a refresh interval of at least 15 seconds.`);
    }
    this.store.set('settings', { ...this.store.get('settings'), ...value, alertsEnabled: true });
    this.log('Broadcast settings saved');
  }
  testAlert() {
    this.alerts.enqueue({ id: `test-${randomUUID()}`, donorName: 'Alex Morgan', amount: 25,
      message: 'Proud to support this community. Keep going!',
      currency: this.store.get('connectionStatus').state === 'connected' ? this.store.get('campaign').currency : 'USD', timestamp: new Date().toISOString(), anonymous: false, test: true });
    this.log('Test alert queued · campaign total unchanged');
  }
  resendDonation({ donationId }: Commands['resendDonation']) {
    const donation = this.store.get('recentDonations').find((item) => item.id === donationId);
    if (!donation) throw new ProviderError('This donation is no longer in recent donations. Choose one from the current list.');
    const key = this.store.get('donationLedger').campaignKey || (this.store.get('settings').provider === 'mock' ? 'mock:demo' : `legacy:${this.store.get('settings').provider}`);
    const { entries } = this.history.capture([donation], key, this.store.get('campaign').title);
    this.sendDonation({ entryId: entries.get(donation.id)!.id });
  }
  sendDonation({ entryId }: Commands['sendDonation']) {
    const entry = this.history.get(entryId);
    // Each intentional send has its own playback ID but retains its history entry.
    this.alerts.enqueue({ ...this.history.content(entry), id: `replay-${randomUUID()}` }, entry.id);
    this.log(`Donation alert queued: ${entry.donorName} · ${formatCurrency(entry.donation.amount, entry.donation.currency)} · campaign total unchanged`);
  }
  editDonation(value: Commands['editDonation']) {
    const entry = this.history.edit(value);
    this.alerts.updatePending(entry.id, { donorName: entry.donorName, message: entry.message });
    this.log('Donation alert text saved · original donation and campaign total unchanged');
  }
  resetDonation({ entryId }: Commands['resetDonation']) {
    const entry = this.history.reset(entryId);
    this.alerts.updatePending(entry.id, { donorName: entry.donorName, message: entry.message });
    this.log('Donation alert text reset to the original · campaign total unchanged');
  }
  setManualAlertControl({ manual }: Commands['setManualAlertControl']) {
    if (manual === this.store.get('donationControl').manual) return;
    this.store.set('donationControl', { manual });
    // An alert already on screen finishes; queued arrivals return to the list.
    if (manual) this.alerts.clear();
    this.log(manual ? 'Manual alert control on · choose donations to send from Donation List & Alerts'
      : 'Automatic alert control on · future donations will play automatically; held donations stay in the list');
  }
  private ensureMock() {
    if (this.provider !== this.mock || this.store.get('connectionStatus').state !== 'connected') throw new ProviderError('Connect Mock / Demo before changing the demo campaign.');
  }
  async editMock(value: Commands['editMock']) {
    this.ensureMock(); await this.refresh(); this.mock.edit(value); await this.refresh();
  }
  async addMockDonation(value: Commands['addMockDonation']) {
    this.ensureMock(); await this.refresh(); this.mock.donate(value.donorName, value.amount, value.message); await this.refresh();
  }
  async resetMock() {
    this.ensureMock();
    this.mock.reset();
    this.log('Demo reset');
    await this.connect(this.store.get('settings'));
  }
}
