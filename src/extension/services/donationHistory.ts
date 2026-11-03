import { randomUUID } from 'node:crypto';
import type { Donation, DonationEntry } from '../../shared/models';
import { editDonationSchema } from '../../shared/models';
import { ProviderError } from '../providers/FundraisingProvider';
import type { StateStore } from './campaignService';

/** Durable public donation records. Provider refreshes never overwrite producer edits. */
export class DonationHistory {
  constructor(private readonly store: StateStore) {}

  capture(donations: Donation[], campaignKey: string, campaignTitle: string) {
    const history = this.store.get('donationHistory');
    const byDonation = new Map(history.filter((entry) => entry.campaignKey === campaignKey)
      .map((entry) => [entry.donation.id, entry]));
    const receivedAt = new Date().toISOString();
    const added = new Set<string>();
    for (const donation of [...donations].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id))) {
      if (byDonation.has(donation.id)) continue;
      const entry: DonationEntry = {
        id: randomUUID(), campaignKey, campaignTitle, donation: structuredClone(donation),
        donorName: donation.donorName, message: donation.message ?? '', receivedAt,
        editedAt: null, sentCount: 0, lastSentAt: null,
      };
      history.push(entry); byDonation.set(donation.id, entry); added.add(donation.id);
    }
    if (added.size) this.store.set('donationHistory', history);
    return { entries: byDonation, added };
  }

  get(entryId: string) {
    const entry = this.store.get('donationHistory').find((item) => item.id === entryId);
    if (!entry) throw new ProviderError('This donation could not be found. Refresh the donation list and try again.');
    return entry;
  }

  content(entry: DonationEntry): Donation {
    const donation = { ...entry.donation, donorName: entry.donorName };
    if (entry.message || donation.message !== undefined) donation.message = entry.message;
    return donation;
  }

  edit(value: unknown) {
    const parsed = editDonationSchema.safeParse(value);
    if (!parsed.success) throw new ProviderError('Enter a donor name of 1–200 characters and a donation message of up to 2,000 characters.');
    const { entryId, donorName, message } = parsed.data;
    const entry = this.get(entryId);
    const changed = donorName !== entry.donation.donorName || message !== (entry.donation.message ?? '');
    const updated = { ...entry, donorName, message, editedAt: changed ? new Date().toISOString() : null };
    this.store.set('donationHistory', this.store.get('donationHistory').map((item) => item.id === entryId ? updated : item));
    return updated;
  }

  reset(entryId: string) {
    const entry = this.get(entryId);
    const updated = { ...entry, donorName: entry.donation.donorName, message: entry.donation.message ?? '', editedAt: null };
    this.store.set('donationHistory', this.store.get('donationHistory').map((item) => item.id === entryId ? updated : item));
    return updated;
  }

  markSent(entryId: string) {
    this.store.set('donationHistory', this.store.get('donationHistory').map((entry) => entry.id === entryId
      ? { ...entry, sentCount: entry.sentCount + 1, lastSentAt: new Date().toISOString() } : entry));
  }
}
