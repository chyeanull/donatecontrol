import { setTimeout as pause } from 'node:timers/promises';
import { z } from 'zod';
import type { CampaignState, Donation, ProviderConfig } from '../../shared/models';
import { percentage } from '../../shared/format';
import { ProviderError, type FundraisingProvider } from './FundraisingProvider';
import { retryAfter } from './GoFundMeProProvider';

const API = 'https://api.givebutter.com/v1';
const id = z.union([z.string().min(1), z.number().int().nonnegative()]).transform(String);
const money = z.number().finite().nonnegative().max(1e12);
const currency = z.string().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase());
const date = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const campaignResponse = z.object({ id, code: z.string(), title: z.string().min(1), url: z.string(),
  raised: money, goal: money.nullish(), currency });
const transactionResponse = z.object({ id, campaign_id: id, status: z.string(), currency,
  transacted_at: date, giving_space: z.object({ name: z.string().nullish(), amount: money.nullish(), message: z.string().nullish() }).nullish(),
});
// The official TransactionResource also permits receipt-only records. They have
// no campaign or public supporter-feed data and must not become donation alerts.
// Require the documented receipt fields so malformed campaign records still fail.
const receiptAmount = z.number().finite();
const receiptResponse = z.object({ id, plan_id: z.string(), pledge_id: z.string(), amount: receiptAmount,
  fee: receiptAmount, fee_covered: receiptAmount, donated: receiptAmount, payout: receiptAmount,
  captured: z.string(), captured_at: z.string(), timezone: z.string(), refunded: z.string(), refunded_at: z.string(),
  line_items: z.array(z.unknown()), fair_market_value_amount: z.string().nullable(),
  tax_deductible_amount: z.string().nullable(), is_recurring: z.string(),
  campaign_id: z.undefined().optional(), giving_space: z.undefined().optional(), status: z.undefined().optional(), currency: z.undefined().optional(),
}).transform(() => null);
const transactionItem = z.union([transactionResponse, receiptResponse]);
const pagination = <T>(item: z.ZodType<T>) => z.object({ data: z.array(item),
  meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive() }) });
export type GivebutterTransaction = z.infer<typeof transactionResponse>;

export function normalizeGivebutterDonation(value: GivebutterTransaction, campaignId: string): Donation | null {
  // Only the public supporter-feed fields belong on air. Never fall back to
  // administrative first_name/last_name, contact information, or private amounts.
  if (value.campaign_id !== campaignId || value.status !== 'succeeded' || !value.giving_space?.amount) return null;
  const name = value.giving_space.name?.trim();
  return { id: `givebutter:${campaignId}:${value.id}`, donorName: name?.slice(0, 120) || 'Anonymous',
    ...(value.giving_space.message?.trim() ? { message: value.giving_space.message.trim().slice(0, 2000) } : {}),
    amount: value.giving_space.amount, currency: value.currency, anonymous: !name || name.toLowerCase() === 'anonymous',
    timestamp: new Date(value.transacted_at).toISOString() };
}

export class GivebutterProvider implements FundraisingProvider {
  private abort = new AbortController();
  private campaignId = '';
  private nextRequest = 0;
  private campaignUrl = '';
  constructor(private readonly apiKey?: string, private readonly fetcher: typeof fetch = fetch) {}
  async connect(config: ProviderConfig) {
    if (!this.apiKey) throw new ProviderError('Save your Givebutter API key in Campaign connection, then connect.');
    this.abort = new AbortController();
    let reference = config.campaignId.trim();
    if (!reference && config.campaignUrl) {
      let url: URL;
      try { url = new URL(config.campaignUrl); } catch { throw new ProviderError('Enter a complete Givebutter campaign URL or campaign ID/code.'); }
      if (url.protocol !== 'https:' || !['givebutter.com', 'www.givebutter.com'].includes(url.hostname) || url.username || url.password) {
        throw new ProviderError('Enter a https://givebutter.com campaign URL, or supply the campaign ID/code.');
      }
      reference = url.pathname.split('/').filter(Boolean)[0] ?? '';
    }
    if (!reference || !/^[\w-]+$/.test(reference)) throw new ProviderError('Enter your Givebutter campaign ID/code or public campaign URL.');
    this.campaignUrl = config.campaignUrl;
    if (/^\d+$/.test(reference)) { this.campaignId = reference; return; }
    for (let page = 1; page <= 100; page++) {
      const result = await this.get(`/campaigns?page=${page}&per_page=100`, pagination(campaignResponse));
      this.checkPage(page, result.meta.current_page);
      const match = result.data.find((campaign) => campaign.id === reference || campaign.code === reference || this.slug(campaign.url) === reference);
      if (match) { this.campaignId = match.id; return; }
      if (page >= result.meta.last_page) throw new ProviderError('Givebutter campaign not found in this account. Check the campaign URL/code and API key.');
    }
    throw new ProviderError('This Givebutter account exceeds the campaign lookup limit. Enter its numeric campaign ID.');
  }
  private slug(value: string) { try { return new URL(value).pathname.split('/').filter(Boolean)[0]; } catch { return undefined; } }
  private checkPage(requested: number, returned: number) {
    if (requested !== returned) throw new ProviderError('Givebutter returned inconsistent pagination. Reconnect after the API recovers.');
  }
  async disconnect() { this.abort.abort(); }
  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
      const wait = this.nextRequest - Date.now();
      if (wait > 0) await pause(wait, undefined, { signal: this.abort.signal });
      // Stay below the documented 500 requests/minute, including pagination.
      this.nextRequest = Date.now() + 150;
      response = await this.fetcher(`${API}${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${this.apiKey}` },
        redirect: 'error', signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(12000)]) });
    } catch { throw new ProviderError('Givebutter could not be reached or timed out. Retrying automatically.', true); }
    if (response.status === 429) throw new ProviderError('Givebutter is rate limiting requests. Waiting before retrying.', true, retryAfter(response.headers.get('retry-after')));
    if (response.status >= 500 || response.status === 408) throw new ProviderError('Givebutter is temporarily unavailable. Retrying automatically.', true, retryAfter(response.headers.get('retry-after')));
    if (response.status === 401 || response.status === 403) throw new ProviderError('Givebutter authentication failed. Check your saved API key and campaign access.');
    if (response.status === 404) throw new ProviderError('Givebutter campaign not found. Check the campaign ID and account access.');
    if (!response.ok) throw new ProviderError(`Givebutter rejected the request (HTTP ${response.status}).`);
    try { return schema.parse(await response.json()); }
    catch { throw new ProviderError('Givebutter returned an unexpected response. Last valid graphics are preserved; check API compatibility.'); }
  }
  async getCampaign(): Promise<CampaignState> {
    const value = await this.get(`/campaigns/${encodeURIComponent(this.campaignId)}`, campaignResponse);
    if (value.id !== this.campaignId) throw new ProviderError('Givebutter returned a different campaign. Check the campaign ID.');
    return { id: value.id, url: this.campaignUrl || value.url, title: value.title.slice(0, 200), currency: value.currency,
      raised: value.raised, goal: value.goal ?? 0, percent: percentage(value.raised, value.goal ?? 0),
      connected: true, lastUpdated: new Date().toISOString() };
  }
  async getRecentDonations(): Promise<Donation[]> {
    const donations: Donation[] = [];
    // The current published operation has no campaign filter. Filter locally
    // after validation; never expose other campaigns or private contact fields.
    for (let page = 1; page <= 100; page++) {
      const result = await this.get(`/transactions?page=${page}&per_page=100&sortByDesc=created_at`, pagination(transactionItem));
      this.checkPage(page, result.meta.current_page);
      for (const value of result.data) { const donation = value && normalizeGivebutterDonation(value, this.campaignId); if (donation) donations.push(donation); }
      if (page >= result.meta.last_page) return donations;
    }
    throw new ProviderError('This Givebutter account exceeds the 10,000-transaction polling limit. No partial update was applied.');
  }
}
