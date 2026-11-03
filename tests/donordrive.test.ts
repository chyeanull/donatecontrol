import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DonorDriveProvider, validateDonorDriveConfig } from '../src/extension/providers/DonorDriveProvider';
import { defaults, settingsSchema } from '../src/shared/models';

const config = { campaignUrl: 'https://charity.donordrive.com/index.cfm?fuseaction=donorDrive.participant&participantID=123', campaignId: '' };
const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
const about = { currency: { label: 'CAD' } };
const campaign = { participantID: 123, displayName: 'Stream for Good', fundraisingGoal: 1000, sumDonations: 500, numDonations: 8 };
const donation = { donationID: 'first', amount: 25, displayName: 'Public name', createdDateUTC: '2026-10-10T12:00:00.0+0000' };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('DonorDrive public API', () => {
  it('accepts participant, team, and event URLs and numeric IDs on custom domains', () => {
    expect(validateDonorDriveConfig(config)).toMatchObject({ origin: 'https://charity.donordrive.com', id: '123', resource: 'participants' });
    expect(validateDonorDriveConfig({ campaignUrl: 'https://www.extra-life.org/participant/42', campaignId: '' }).id).toBe('42');
    expect(validateDonorDriveConfig({ campaignUrl: 'https://example.org/?TEAMid=7', campaignId: '', donorDriveResource: 'teams' }).id).toBe('7');
    expect(validateDonorDriveConfig({ campaignUrl: 'https://example.org/custom-event', campaignId: '8', donorDriveResource: 'events' }).resource).toBe('events');
    expect(() => validateDonorDriveConfig({ ...config, campaignId: 'alias' })).toThrow('numeric');
    expect(() => validateDonorDriveConfig({ campaignUrl: 'https://example.org/custom-name', campaignId: '' })).toThrow('numeric');
    for (const campaignUrl of ['http://example.org', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://user:secret@example.org', 'https://example.org:8443']) {
      expect(() => validateDonorDriveConfig({ campaignUrl, campaignId: '123' })).toThrow('public HTTPS');
    }
  });
  it('keeps old persisted settings valid and fills the new default without losing configuration', () => {
    const { donorDriveResource: _, ...legacy } = { ...defaults.settings, provider: 'gofundme-pro' as const, campaignId: '456' };
    expect(settingsSchema.parse(legacy)).toEqual({ ...legacy, donorDriveResource: 'participants' });
    expect(z.toJSONSchema(settingsSchema).required).not.toContain('donorDriveResource');
  });
  it.each(['participants', 'teams', 'events'] as const)('normalizes %s, currency, totals, donor privacy and registration fees without authentication', async (resource) => {
    const record = { ...campaign, participantID: 123, teamID: 123, eventID: 123, name: 'Team or event' };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(about)).mockResolvedValueOnce(json(record))
      .mockResolvedValueOnce(json([{ ...donation, message: '  For a good cause!  ' }, { ...donation, donationID: 'anon', displayName: null, message: null },
        { ...donation, donationID: 'private', amount: null }, { ...donation, donationID: 'fee', isRegFee: true }]));
    const provider = new DonorDriveProvider(fetcher);
    await provider.connect({ ...config, campaignId: '123', donorDriveResource: resource });
    expect(await provider.getCampaign()).toMatchObject({ id: `${resource}/123`, currency: 'CAD', raised: 500, goal: 1000, percent: 50 });
    const values = await provider.getRecentDonations();
    expect(values).toHaveLength(2);
    expect(values[0].message).toBe('For a good cause!');
    expect(values[1].message).toBeUndefined();
    expect(values[1]).toMatchObject({ donorName: 'Anonymous', anonymous: true, currency: 'CAD' });
    expect(fetcher.mock.calls.every(([url, options]) => String(url).includes('version=1.3') && !new Headers(options?.headers).has('Authorization'))).toBe(true);
    expect(String(fetcher.mock.calls[2][0])).toContain(`/api/${resource}/123/donations?limit=100&offset=0`);
    await provider.disconnect();
  });
  it('uses ETags, skips unchanged donation reads, and throttles manual refreshes and reconnects', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(about)).mockResolvedValueOnce(json(campaign, 200, { ETag: 'campaign-1' }))
      .mockResolvedValueOnce(json([donation])).mockResolvedValueOnce(new Response(null, { status: 304 }));
    const provider = new DonorDriveProvider(fetcher);
    await provider.connect(config); await provider.getCampaign(); await provider.getRecentDonations();
    await provider.getCampaign(); await provider.getRecentDonations();
    await provider.disconnect(); await provider.connect(config); await provider.getCampaign(); await provider.getRecentDonations();
    expect(fetcher).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(15000);
    await provider.getCampaign(); await provider.getRecentDonations();
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(new Headers(fetcher.mock.calls[3][1]?.headers).get('If-None-Match')).toBe('campaign-1');
    await provider.disconnect();
  });
  it('paginates a burst past 100 donations, including equal timestamps at a page boundary', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(about)).mockResolvedValueOnce(json(campaign)).mockResolvedValueOnce(json([donation]));
    const provider = new DonorDriveProvider(fetcher);
    await provider.connect(config); await provider.getCampaign(); await provider.getRecentDonations();
    const burst = Array.from({ length: 105 }, (_, i) => ({ ...donation, donationID: `new-${i}`, createdDateUTC: donation.createdDateUTC }));
    fetcher.mockResolvedValueOnce(json({ ...campaign, sumDonations: 1000 })).mockResolvedValueOnce(json(burst.slice(0, 100)))
      .mockResolvedValueOnce(json([...burst.slice(100), donation]));
    await vi.advanceTimersByTimeAsync(15000);
    await provider.getCampaign();
    expect(await provider.getRecentDonations()).toHaveLength(106);
    expect(String(fetcher.mock.calls[5][0])).toContain('offset=100');
    await provider.disconnect();
  });
  it('catches bursts after an empty baseline and retries donations after a failed nested request even when the campaign is unchanged', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T11:59:00Z'));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(about)).mockResolvedValueOnce(json(campaign)).mockResolvedValueOnce(json([]));
    const provider = new DonorDriveProvider(fetcher);
    await provider.connect(config); await provider.getCampaign(); await provider.getRecentDonations();
    await vi.advanceTimersByTimeAsync(60000);
    fetcher.mockResolvedValueOnce(json(campaign, 200, { ETag: 'changed' })).mockResolvedValueOnce(json({}, 503));
    await provider.getCampaign(); await expect(provider.getRecentDonations()).rejects.toMatchObject({ retryable: true });
    await vi.advanceTimersByTimeAsync(15000);
    const burst = Array.from({ length: 105 }, (_, i) => ({ ...donation, donationID: `new-${i}` }));
    fetcher.mockResolvedValueOnce(new Response(null, { status: 304 })).mockResolvedValueOnce(json(burst.slice(0, 100))).mockResolvedValueOnce(json(burst.slice(100)));
    await provider.getCampaign(); expect(await provider.getRecentDonations()).toHaveLength(105);
    await provider.disconnect();
  });
  it('honors rate limits, rejects missing totals, and accepts zero goals', async () => {
    const limited = new DonorDriveProvider(vi.fn<typeof fetch>().mockResolvedValue(json({}, 429, { 'Retry-After': '120' })));
    await expect(limited.connect(config)).rejects.toMatchObject({ retryable: true, retryAfterMs: 120000 });
    const missing = new DonorDriveProvider(vi.fn<typeof fetch>().mockResolvedValueOnce(json(about)).mockResolvedValueOnce(json({ participantID: 123, displayName: 'Missing total' })));
    await missing.connect(config); await expect(missing.getCampaign()).rejects.toThrow('unexpected response');
    const noGoal = new DonorDriveProvider(vi.fn<typeof fetch>().mockResolvedValueOnce(json(about)).mockResolvedValueOnce(json({ ...campaign, fundraisingGoal: null })));
    await noGoal.connect(config); expect(await noGoal.getCampaign()).toMatchObject({ goal: 0, percent: 0 });
    await limited.disconnect(); await missing.disconnect(); await noGoal.disconnect();
  });
});
