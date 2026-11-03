import { randomUUID } from 'node:crypto';
import type { CampaignState, Donation, MockState, ProviderConfig } from '../../shared/models';
import { defaults } from '../../shared/models';
import { percentage } from '../../shared/format';
import type { FundraisingProvider } from './FundraisingProvider';

export class MockProvider implements FundraisingProvider {
  constructor(private readonly read: () => MockState, private readonly write: (state: MockState) => void) {}
  async connect(_config: ProviderConfig) {}
  async disconnect() {}
  async getCampaign(): Promise<CampaignState> {
    const state = this.read().campaign;
    return { ...state, connected: true, percent: percentage(state.raised, state.goal), lastUpdated: new Date().toISOString() };
  }
  async getRecentDonations(): Promise<Donation[]> { return structuredClone(this.read().donations); }
  edit(changes: Pick<CampaignState, 'title' | 'raised' | 'goal'>) {
    const state = this.read();
    this.write({ ...state, campaign: { ...state.campaign, ...changes, percent: percentage(changes.raised, changes.goal) } });
  }
  donate(donorName: string, amount: number, message?: string) {
    const state = this.read();
    const donation: Donation = {
      id: `mock-${randomUUID()}`, donorName: donorName || 'Anonymous', amount,
      ...(message?.trim() ? { message: message.trim().slice(0, 2000) } : {}),
      currency: state.campaign.currency, anonymous: !donorName, timestamp: new Date().toISOString(), test: true,
    };
    const raised = Math.round((state.campaign.raised + amount) * 100) / 100;
    if (raised > 1e12) throw new Error('Demo total too large');
    this.write({ campaign: { ...state.campaign, raised, percent: percentage(raised, state.campaign.goal),
      donationCount: (state.campaign.donationCount ?? 0) + 1 }, donations: [...state.donations, donation].slice(-1000) });
    return donation;
  }
  reset() { this.write(structuredClone(defaults.mockState)); }
}
