import { randomUUID } from 'node:crypto';
import type { CampaignState, Donation, MockState, ProviderConfig } from '../../shared/models';
import { defaults } from '../../shared/models';
import { percentage } from '../../shared/format';
import type { FundraisingProvider } from './FundraisingProvider';

const demoDonations = [
  ['Alex', 25, 'Happy to help. Keep up the great work!'],
  ['Sam', 50, 'Cheering you on from home!'],
  ['Jordan', 100, 'For everyone making a difference today.'],
  ['Taylor', 20, 'First time watching, glad to be here!'],
  ['Anonymous', 75, 'Sending a little support your way.'],
  ['Morgan', 12.5, 'Every little bit helps.'],
  ['Casey', 250, 'A big thank you to the whole team!'],
  ['Riley', 35, 'Let’s get closer to that goal.'],
  ['Jamie', 150, 'In honor of the people who always show up for others.'],
  ['Community Crew', 500, 'A group donation from all of us. You’ve got this!'],
] as const;

export class MockProvider implements FundraisingProvider {
  constructor(private readonly read: () => MockState, private readonly write: (state: MockState) => void) {}
  async connect(_config: ProviderConfig) {
    const state = this.read();
    const ids = new Set(state.donations.map((donation) => donation.id));
    const now = Date.now();
    // Historical samples belong to the existing demo total. Stable IDs preserve
    // archive edits/send counts across reconnects and resets, without replaying.
    const samples: Donation[] = demoDonations.map(([donorName, amount, message], index) => ({
      id: `mock-demo-${index + 1}`, donorName, amount, message,
      currency: state.campaign.currency, anonymous: donorName === 'Anonymous', test: true,
      timestamp: new Date(now - (demoDonations.length - index) * 60_000).toISOString(),
    })).filter((donation) => !ids.has(donation.id));
    if (samples.length) this.write({ ...state, donations: [...samples, ...state.donations].slice(-1000) });
  }
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
