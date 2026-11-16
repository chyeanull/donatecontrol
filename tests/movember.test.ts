import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MovemberProvider, validateMovemberConfig } from '../src/extension/providers/MovemberProvider';
import { movemberDonation, movemberFixture } from './helpers/movemberFixture';

vi.mock('node:timers/promises', () => ({ setTimeout: async () => {} }));
const config = { campaignUrl: 'https://api.movember.com/v18/newsfeed/?entity_type=0&entity_id=42&filter_type=donation', campaignId: '' };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z')); });
afterEach(() => { vi.useRealTimers(); });
const stamp = (second: number) => new Date(Date.UTC(2026, 10, 15, 12, 0, second)).toISOString().slice(0, 19).replace('T', ' ');

async function setup() {
  const api = movemberFixture();
  const provider = new MovemberProvider(api.fetcher);
  await provider.connect(config);
  const campaign = await provider.getCampaign();
  return { ...api, provider, campaign };
}

describe('Movember public member API', () => {
  it('accepts feed URLs, public numeric Mo Spaces, and IDs while rejecting mismatches and other entities', () => {
    expect(validateMovemberConfig(config)).toBe('42');
    expect(validateMovemberConfig({ campaignUrl: 'https://ca.movember.com/en/mospace/42', campaignId: '' })).toBe('42');
    expect(validateMovemberConfig({ campaignUrl: '', campaignId: '00042' })).toBe('42');
    expect(validateMovemberConfig({ campaignUrl: 'https://movember.com/m/example', campaignId: '42' })).toBe('42');
    expect(() => validateMovemberConfig({ ...config, campaignId: '43' })).toThrow('different');
    for (const campaignUrl of ['http://movember.com/mospace/42', 'https://evil.test/mospace/42',
      'https://movember.com.evil.test/mospace/42', 'https://user:password@movember.com/mospace/42', 'https://movember.com:1234/mospace/42']) {
      expect(() => validateMovemberConfig({ campaignUrl, campaignId: '' })).toThrow('HTTPS Movember');
    }
    for (const campaignUrl of ['https://movember.com/mospace/team/42', 'https://movember.com/m/example',
      config.campaignUrl.replace('entity_type=0', 'entity_type=1'), config.campaignUrl.replace('entity_id=42', 'entity_id=0')]) {
      expect(() => validateMovemberConfig({ campaignUrl, campaignId: '' })).toThrow();
    }
    expect(() => validateMovemberConfig({ campaignUrl: '', campaignId: '9007199254740993' })).toThrow('numeric');
  });

  it('uses original campaign currency/totals and only public current-year donor fields', async () => {
    const { state, provider, campaign, requests } = await setup();
    const anonymous = movemberDonation(2); anonymous.metadata.anonymous = true; anonymous.metadata.donor.name = 'PRIVATE DONOR NAME';
    const hiddenMessage = movemberDonation(3); hiddenMessage.metadata.show_message = false; hiddenMessage.metadata.message = 'PRIVATE MESSAGE';
    const hidden = movemberDonation(4); hidden.metadata.show = false;
    const hiddenPost = movemberDonation(5); hiddenPost.isHidden = true;
    const previousYear = movemberDonation(6, '2025-11-01 12:00:00'); previousYear.metadata.is_current_campaign = false;
    const zero = movemberDonation(7); zero.metadata.amount = '0';
    state.donations = [movemberDonation(1), anonymous, hiddenMessage, hidden, hiddenPost, previousYear, zero];
    const donations = await provider.getRecentDonations();
    expect(campaign).toMatchObject({ id: 'member/42/2026', url: 'https://us.movember.com/mospace/42', raised: 250, goal: 1000, currency: 'USD', percent: 25 });
    expect(campaign.donationCount).toBeUndefined(); // The API does not report a total donation count.
    expect(donations).toHaveLength(3);
    expect(donations.find((d) => d.id.endsWith(':2'))).toMatchObject({ donorName: 'Anonymous', anonymous: true });
    expect(donations.find((d) => d.id.endsWith(':3'))?.message).toBeUndefined();
    expect(donations[0].timestamp).toBe('2026-11-15T12:00:00.000Z');
    expect(JSON.stringify({ campaign, donations })).not.toMatch(/PRIVATE|private@example|convertedAmount|contactId/);
    expect(requests.every((r) => !r.headers.has('Authorization') && !r.headers.has('Cookie'))).toBe(true);
  });

  it('imports multiple historical pages and overlaps timestamp ties without duplicating donations', async () => {
    const { state, provider, requests } = await setup();
    state.donations = Array.from({ length: 125 }, (_, i) => movemberDonation(i + 1, stamp(Math.floor(i / 3))));
    expect(await provider.getRecentDonations()).toHaveLength(125);
    expect(requests.filter((r) => r.url.pathname.includes('newsfeed')).length).toBeGreaterThan(4);
    const before = requests.length;
    await provider.getCampaign(); await provider.getRecentDonations();
    expect(requests).toHaveLength(before);
  });

  it('expands a crowded timestamp to 90 records, and rejects a boundary it cannot fully retrieve', async () => {
    const { state, provider, requests } = await setup();
    state.donations = Array.from({ length: 70 }, (_, i) => movemberDonation(i + 1));
    expect(await provider.getRecentDonations()).toHaveLength(70);
    expect(requests.some((r) => r.url.searchParams.get('limit') === '90')).toBe(true);
    state.donations = Array.from({ length: 105 }, (_, i) => movemberDonation(i + 1, '2026-11-16 12:00:10'));
    vi.setSystemTime(Date.now() + 16000); await provider.getCampaign();
    await expect(provider.getRecentDonations()).rejects.toThrow('same timestamp');
  });

  it('catches arrivals after an empty baseline, and only caches complete successful polls', async () => {
    const { state, provider, requests } = await setup();
    expect(await provider.getRecentDonations()).toEqual([]);
    vi.setSystemTime(Date.now() + 16000);
    state.donations = Array.from({ length: 50 }, (_, i) => movemberDonation(i + 1, stamp(86410 + i)));
    state.error = { path: '/newsfeed', status: 503, page: 2 };
    await provider.getCampaign(); await expect(provider.getRecentDonations()).rejects.toMatchObject({ retryable: true });
    state.error = null;
    await provider.getCampaign(); expect(await provider.getRecentDonations()).toHaveLength(50);
    const count = requests.length;
    await provider.getCampaign(); await provider.getRecentDonations();
    expect(requests).toHaveLength(count);
  });

  it('honors Retry-After and rejects private, malformed, or mismatched campaigns without exposing response details', async () => {
    const api = movemberFixture(); const provider = new MovemberProvider(api.fetcher); await provider.connect(config);
    api.state.error = { path: '/member', status: 429, retryAfter: '120' };
    await expect(provider.getCampaign()).rejects.toMatchObject({ retryable: true, retryAfterMs: 120000 });
    api.state.error = { path: '/member', status: 403 };
    await expect(provider.getCampaign()).rejects.toThrow('not publicly accessible');
    api.state.error = null; api.state.member.visibility = 'private';
    await expect(provider.getCampaign()).rejects.toThrow('unexpected public response');
    api.state.member.visibility = 'public'; api.state.member.id = 99;
    await expect(provider.getCampaign()).rejects.toThrow('different member');
    api.state.member.id = 42; api.state.member.AmountRaised.originalAmount = 'not money';
    await expect(provider.getCampaign()).rejects.toThrow('unexpected public response');
    api.state.member.AmountRaised.originalAmount = '0'; api.state.member.targetAmount = '0';
    expect(await provider.getCampaign()).toMatchObject({ raised: 0, goal: 0, percent: 0 });
  });

  it('rejects malformed donation flags, foreign fundraisers, and ignored cursors', async () => {
    const { state, provider } = await setup();
    const row = movemberDonation(1);
    state.donations = [row]; row.entity.id = '99';
    await expect(provider.getRecentDonations()).rejects.toThrow('different fundraiser');
    row.entity.id = '42'; Reflect.deleteProperty(row.metadata, 'anonymous');
    await expect(provider.getRecentDonations()).rejects.toThrow('unexpected public response');
    state.donations = Array.from({ length: 80 }, (_, i) => movemberDonation(i + 1, stamp(i)));
    state.ignoreCursor = true;
    await expect(provider.getRecentDonations()).rejects.toThrow('ordering');
  });

  it('keeps fundraising years separate and aborts requests when disconnected', async () => {
    const { state, provider, requests } = await setup();
    state.donations = [movemberDonation(1)]; await provider.getRecentDonations();
    vi.setSystemTime(new Date('2027-01-02T00:00:00Z'));
    state.configuration.campaign.current = { year: '2027', campaignStart: '2027-01-01 08:00:00', campaignEnd: '2028-01-01 07:59:59' };
    state.donations = [movemberDonation(2, '2027-01-01 12:00:00'), movemberDonation(1)];
    expect((await provider.getCampaign()).id).toBe('member/42/2027');
    expect((await provider.getRecentDonations()).map((d) => d.id)).toEqual(['movember:member/42/2027:2']);
    await provider.disconnect(); expect(requests.at(-1)?.signal?.aborted).toBe(true);
  });
});
