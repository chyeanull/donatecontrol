import type { Donation, DonationLedger } from '../../shared/models';

export function detectDonations(donations: Donation[], ledger: DonationLedger, campaignKey: string, baseline: boolean, now = new Date().toISOString()) {
  const sameCampaign = ledger.campaignKey === campaignKey;
  const seen = new Set(sameCampaign ? ledger.seenIds : []);
  const cutoff = baseline ? now : (sameCampaign ? ledger.cutoff : now);
  const newDonations: Donation[] = [];
  const unique = new Map(donations.map((donation) => [donation.id, donation]));
  const ordered = [...unique.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  for (const donation of ordered) {
    if (!baseline && !seen.has(donation.id) && (!cutoff || donation.timestamp >= cutoff)) newDonations.push(donation);
    seen.add(donation.id);
  }
  // Two full maximum-sized provider scans; every reconnect establishes a fresh baseline.
  const nextLedger: DonationLedger = { campaignKey, cutoff, seenIds: [...seen].slice(-20000) };
  return { newDonations, ledger: nextLedger, recent: ordered.slice(-50).reverse() };
}
