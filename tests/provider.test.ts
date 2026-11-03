import { describe, expect, it, vi } from 'vitest';
import { GoFundMeProProvider, normalizeTransaction, retryAfter, validateProConfig } from '../src/extension/providers/GoFundMeProProvider';

const transaction = { id: '42', status: 'success', is_anonymous: false, hide_amount: false, member_name: 'Rob',
  raw_donation_gross_amount: 50, raw_currency_code: 'USD', created_at: '2026-10-02T12:00:00Z', purchased_at: '2026-10-02T12:00:00Z' };
const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
describe('GoFundMe Pro contract', () => {
  it('rejects consumer URLs, malformed URLs, and missing numeric IDs', () => {
    for (const campaignUrl of ['https://www.gofundme.com/f/test', 'https://gofund.me/abc']) {
      expect(() => validateProConfig({ campaignUrl, campaignId: '123' })).toThrow('Ordinary GoFundMe');
    }
    expect(() => validateProConfig({ campaignUrl: 'invalid', campaignId: '123' })).toThrow('complete campaign URL');
    expect(() => validateProConfig({ campaignUrl: '', campaignId: '' })).toThrow('numeric campaign ID');
    expect(() => validateProConfig({ campaignUrl: '', campaignId: '123' })).not.toThrow();
  });
  it('protects anonymous names and hidden amounts, handles missing names, ignores failed and refunded donations', () => {
    expect(normalizeTransaction({ ...transaction, is_anonymous: true })?.donorName).toBe('Anonymous');
    expect(normalizeTransaction({ ...transaction, member_name: null })?.donorName).toBe('A generous donor');
    expect(normalizeTransaction({ ...transaction, hide_amount: true })).toBeNull();
    expect(normalizeTransaction({ ...transaction, status: 'refunded' })).toBeNull();
    expect(normalizeTransaction({ ...transaction, status: 'failed' })).toBeNull();
    expect(normalizeTransaction({ ...transaction, raw_donation_gross_amount: 0 })).toBeNull();
  });
  it('uses official OAuth, renews an expired token once, validates totals and paginates', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: 'first', expires_in: 3600, token_type: 'bearer' }))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ access_token: 'renewed', expires_in: 3600, token_type: 'bearer' }))
      .mockResolvedValueOnce(json({ id: 123, name: 'Charity Stream', currency_code: 'USD', goal: 25000 }))
      .mockResolvedValueOnce(json({ total_gross_amount: 12500, transactions_count: 128 }))
      .mockResolvedValueOnce(json({ current_page: 1, last_page: 2, data: [{ ...transaction, id: 42 }] }))
      .mockResolvedValueOnce(json({ current_page: 2, last_page: 2, data: [{ ...transaction, id: 43, is_anonymous: true }] }));
    const provider = new GoFundMeProProvider({ clientId: 'example-id', clientSecret: 'example-secret' }, fetcher);
    await provider.connect({ campaignId: '123', campaignUrl: '' });
    const campaign = await provider.getCampaign();
    expect(campaign.percent).toBe(50); expect(campaign.raised).toBe(12500);
    const donations = await provider.getRecentDonations();
    expect(donations.map((d) => d.id)).toEqual(['42', '43']); expect(donations[1].donorName).toBe('Anonymous');
    expect(fetcher.mock.calls[0][0]).toBe('https://api.classy.org/oauth2/auth');
    expect(String(fetcher.mock.calls[0][1]?.body)).toContain('grant_type=client_credentials');
    expect(fetcher.mock.calls[4][0]).toBe('https://api.classy.org/2.0/campaigns/123/overview');
    expect(String(fetcher.mock.calls[6][0])).toContain('page=2');
    await provider.disconnect();
  });
  it('keeps provider secrets out of errors, supports missing goals, and rejects malformed totals', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: 'private-token', expires_in: 3600, token_type: 'bearer' }))
      .mockResolvedValueOnce(json({ id: 123, name: 'No goal', currency_code: 'USD', goal: null }))
      .mockResolvedValueOnce(json({ total_gross_amount: 20, transactions_count: 1 }))
      .mockResolvedValueOnce(json({ id: 123, name: 'No goal', currency_code: 'USD' }))
      .mockResolvedValueOnce(json({ total_gross_amount: 'malformed private-token' }));
    const provider = new GoFundMeProProvider({ clientId: 'id', clientSecret: 'secret' }, fetcher);
    await provider.connect({ campaignId: '123', campaignUrl: '' });
    expect((await provider.getCampaign()).percent).toBe(0);
    await expect(provider.getCampaign()).rejects.toThrow('unexpected response');
    await provider.disconnect();
  });
  it('parses seconds and HTTP dates in Retry-After', () => {
    expect(retryAfter('120')).toBe(120000);
    expect(retryAfter('Fri, 02 Oct 2026 12:02:00 GMT', Date.parse('2026-10-02T12:00:00Z'))).toBe(120000);
    expect(retryAfter('garbage')).toBe(0);
  });
});
