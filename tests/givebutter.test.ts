import { describe, expect, it, vi } from 'vitest';
import { GivebutterProvider } from '../src/extension/providers/GivebutterProvider';

const config = { campaignId: '42', campaignUrl: '' };
const campaign = { id: 42, code: 'abc123', title: 'Community Fund', url: 'https://givebutter.com/community', raised: 1250, goal: 5000, currency: 'usd', donors: 12 };
const transaction = { id: 100, campaign_id: 42, status: 'succeeded', currency: 'USD', transacted_at: '2026-10-11T12:00:00Z',
  giving_space: { name: 'Public name', amount: 25 }, first_name: 'PRIVATE', last_name: 'BILLING', amount: 500, email: 'private@example.com' };
const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
const page = (data: unknown[], current = 1, last = 1) => ({ data, meta: { current_page: current, last_page: last } });

describe('Givebutter API', () => {
  it('requires credentials and only accepts official campaign URLs for lookup', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(new GivebutterProvider(undefined, fetcher).connect(config)).rejects.toThrow('API key');
    for (const campaignUrl of ['https://example.com/fund', 'http://givebutter.com/fund', 'https://user:secret@givebutter.com/fund']) {
      await expect(new GivebutterProvider('fixture-key', fetcher).connect({ campaignId: '', campaignUrl })).rejects.toThrow('https://givebutter.com');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('resolves a campaign URL through paginated account campaigns and authenticates only to the API', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(page([], 1, 2)))
      .mockResolvedValueOnce(json(page([campaign], 2, 2))).mockResolvedValueOnce(json(campaign));
    const provider = new GivebutterProvider('fixture-key', fetcher);
    await provider.connect({ campaignId: '', campaignUrl: campaign.url });
    const value = await provider.getCampaign();
    expect(value).toMatchObject({ id: '42', title: campaign.title, raised: 1250, goal: 5000, percent: 25, currency: 'USD' });
    expect(value).not.toHaveProperty('donationCount'); // Unique donors are not donation count.
    expect(String(fetcher.mock.calls[1][0])).toContain('page=2');
    for (const [url, options] of fetcher.mock.calls) {
      expect(new URL(String(url)).origin).toBe('https://api.givebutter.com');
      expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer fixture-key');
      expect(options?.redirect).toBe('error');
    }
    await provider.disconnect();
  });
  it('paginates donations, filters the campaign and successful status, and preserves public privacy fields', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(page([
      { ...transaction, giving_space: { ...transaction.giving_space, message: '  Keep going!  ' } }, { ...transaction, id: 101, message: 'PRIVATE NOTE', giving_space: { name: null, amount: 12, message: null } },
      { ...transaction, id: 102, giving_space: { name: 'Hidden amount', amount: null } },
      { ...transaction, id: 103, giving_space: null }, { ...transaction, id: 104, status: 'pending' },
      { ...transaction, id: 105, status: 'refunded' }, { ...transaction, id: 106, campaign_id: 99 },
    ], 1, 2))).mockResolvedValueOnce(json(page([{ ...transaction, id: 107, giving_space: { name: 'Anonymous', amount: 5 } }], 2, 2)));
    const provider = new GivebutterProvider('fixture-key', fetcher); await provider.connect(config);
    const values = await provider.getRecentDonations();
    expect(values).toHaveLength(3);
    expect(values[0].message).toBe('Keep going!');
    expect(values[1].message).toBeUndefined();
    expect(values[2].message).toBeUndefined();
    expect(values[0]).toMatchObject({ id: 'givebutter:42:100', donorName: 'Public name', amount: 25, anonymous: false });
    expect(values[1]).toMatchObject({ donorName: 'Anonymous', amount: 12, anonymous: true });
    expect(values[2].anonymous).toBe(true);
    expect(JSON.stringify(values)).not.toMatch(/PRIVATE|BILLING|private@example/);
    expect(String(fetcher.mock.calls[1][0])).toContain('page=2&per_page=100&sortByDesc=created_at');
    await provider.disconnect();
  });
  it.each([401, 403, 429, 503])('handles HTTP %s without publishing response bodies or keys', async (status) => {
    const provider = new GivebutterProvider('secret-key', vi.fn<typeof fetch>().mockResolvedValue(json({ error: 'private-body' }, status, { 'Retry-After': '60' })));
    await provider.connect(config);
    try { await provider.getCampaign(); expect.fail('Expected failure'); }
    catch (error) {
      expect(String(error)).not.toMatch(/secret-key|private-body/);
      expect(error).toMatchObject({ retryable: status === 429 || status === 503 });
      if (status === 429) expect(error).toMatchObject({ retryAfterMs: 60000 });
    }
  });
  it('rejects mismatched IDs, malformed data, and inconsistent pagination', async () => {
    for (const response of [{ ...campaign, id: 99 }, { ...campaign, raised: 'invalid' }]) {
      const provider = new GivebutterProvider('fixture-key', vi.fn<typeof fetch>().mockResolvedValue(json(response)));
      await provider.connect(config); await expect(provider.getCampaign()).rejects.toThrow();
    }
    const provider = new GivebutterProvider('fixture-key', vi.fn<typeof fetch>().mockResolvedValue(json(page([transaction], 2, 2))));
    await provider.connect(config); await expect(provider.getRecentDonations()).rejects.toThrow('pagination');
  });
});

it('ignores the documented receipt-only transaction variant without losing public campaign donations', async () => {
  // TransactionResource.anyOf[0] in the official OpenAPI has receipt details but
  // no campaign, currency, status or public giving_space. It cannot be an alert.
  const receipt = {id:'receipt-1',plan_id:'plan-1',pledge_id:'',amount:10,fee:0,fee_covered:0,donated:10,payout:10,
    captured:'1',captured_at:'2026-11-01T12:00:00Z',timezone:'UTC',refunded:'0',refunded_at:'',line_items:[],
    fair_market_value_amount:null,tax_deductible_amount:null,is_recurring:'1'};
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(page([receipt,{...receipt,id:'refund-receipt',payout:-10},transaction])));
  const provider = new GivebutterProvider('fixture-key',fetcher);
  await provider.connect(config);
  expect(await provider.getRecentDonations()).toEqual([expect.objectContaining({id:'givebutter:42:100',amount:25})]);
  await provider.disconnect();
});
