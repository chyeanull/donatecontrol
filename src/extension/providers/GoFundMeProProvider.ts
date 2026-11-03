import { z } from 'zod';
import type { CampaignState, Donation, ProviderConfig } from '../../shared/models';
import { percentage } from '../../shared/format';
import { ProviderError, type FundraisingProvider } from './FundraisingProvider';

// Official references and endpoint provenance are recorded in docs/api-integration.md.
const API = 'https://api.classy.org';
const amount = z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).pipe(z.number().finite().nonnegative().max(1e12));
const currency = z.string().regex(/^[A-Z]{3}$/);
const identifier = z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(String);
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid timestamp');
const apiCampaign = z.object({ id: identifier, name: z.string().min(1), currency_code: currency, goal: amount.nullish() });
const overview = z.object({ total_gross_amount: amount, transactions_count: z.number().int().nonnegative() });
const transaction = z.object({
  id: identifier, status: z.string(), is_anonymous: z.boolean(), hide_amount: z.boolean(),
  member_name: z.string().nullish(), raw_donation_gross_amount: amount.nullish(),
  raw_currency_code: currency.nullish(), purchased_at: timestamp.nullish(), created_at: timestamp,
});
const pageSchema = z.object({ current_page: z.number().int().positive(), last_page: z.number().int().nonnegative(), data: z.array(transaction) });
const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive(), token_type: z.string() });
export type ProCampaignResponse = z.infer<typeof apiCampaign>;
export type ProTransactionResponse = z.infer<typeof transaction>;

export function retryAfter(value: string | null, now = Date.now()): number {
  if (!value) return 0;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}
export function validateProConfig(config: ProviderConfig): void {
  if (config.campaignUrl) {
    let url: URL;
    try { url = new URL(config.campaignUrl); } catch { throw new ProviderError('Enter a complete campaign URL starting with https://.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new ProviderError('Enter a valid public campaign URL.');
    const host = url.hostname.toLowerCase();
    if (host === 'gofund.me' || host.endsWith('.gofund.me') || host === 'gofundme.com' || host === 'www.gofundme.com') {
      throw new ProviderError('Ordinary GoFundMe campaigns are not supported by the Pro API. Use Mock / Demo, or enter a GoFundMe Pro / Classy campaign ID with organization API access.');
    }
  }
  if (!/^\d+$/.test(config.campaignId ?? '') || Number(config.campaignId) <= 0) throw new ProviderError('GoFundMe Pro requires a numeric campaign ID from your organization. A public URL alone does not provide API access.');
}
export function normalizeTransaction(value: ProTransactionResponse): Donation | null {
  // Respect donor privacy: hidden amounts never enter a browser Replicant.
  if (value.status !== 'success' || value.hide_amount || !value.raw_donation_gross_amount || !value.raw_currency_code) return null;
  return {
    id: value.id, donorName: value.is_anonymous ? 'Anonymous' : value.member_name?.trim().slice(0, 120) || 'A generous donor',
    amount: value.raw_donation_gross_amount, currency: value.raw_currency_code,
    timestamp: new Date(value.purchased_at ?? value.created_at).toISOString(), anonymous: value.is_anonymous,
  };
}
export class GoFundMeProProvider implements FundraisingProvider {
  private config: ProviderConfig = { campaignId: '', campaignUrl: '' };
  private token = '';
  private expiresAt = 0;
  private abort = new AbortController();
  constructor(private readonly credentials: { clientId?: string; clientSecret?: string }, private readonly fetcher: typeof fetch = fetch) {}

  async connect(config: ProviderConfig) {
    validateProConfig(config);
    if (!this.credentials.clientId || !this.credentials.clientSecret) throw new ProviderError('Enter your Client ID and Client Secret in the dashboard’s GoFundMe Pro credentials form, save them, then connect.');
    this.config = config;
    this.abort = new AbortController();
    await this.authenticate();
  }
  async disconnect() { this.abort.abort(); this.token = ''; this.expiresAt = 0; }
  private async http(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetcher(`${API}${path}`, {
        ...init, redirect: 'error', signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(12000)]),
      });
    } catch { throw new ProviderError('GoFundMe Pro could not be reached or timed out. Retrying automatically.', true); }
    if (response.ok) return response;
    if (response.status === 429) throw new ProviderError('GoFundMe Pro is rate limiting requests. Waiting before retrying.', true, retryAfter(response.headers.get('retry-after')));
    if (response.status >= 500 || response.status === 408) throw new ProviderError('GoFundMe Pro is temporarily unavailable. Retrying automatically.', true, retryAfter(response.headers.get('retry-after')));
    if (response.status === 401 || response.status === 403) throw new ProviderError('GoFundMe Pro authentication failed. Check server credentials and organization access, then reconnect.');
    if (response.status === 404) throw new ProviderError('Campaign not found. Check the Pro campaign ID and your organization access.');
    throw new ProviderError(`GoFundMe Pro rejected the request (HTTP ${response.status}). Check the campaign configuration.`);
  }
  private async parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    try { return schema.parse(await response.json()); }
    catch { throw new ProviderError('GoFundMe Pro returned an unexpected response. Last valid graphics are preserved; check API compatibility.'); }
  }
  private async authenticate() {
    const response = await this.http('/oauth2/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.credentials.clientId ?? '', client_secret: this.credentials.clientSecret ?? '' }),
    });
    const data = await this.parse(response, tokenSchema);
    this.token = data.access_token;
    this.expiresAt = Date.now() + Math.max(1, data.expires_in - 60) * 1000;
  }
  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    if (!this.token || Date.now() >= this.expiresAt) await this.authenticate();
    // Retry one rejected token once, without ever logging response bodies or credentials.
    let refreshed = false;
    const authorizedFetch: typeof fetch = this.fetcher;
    const request = async () => {
      try {
        return await authorizedFetch(`${API}/2.0${path}`, { headers: { Authorization: `Bearer ${this.token}` },
          redirect: 'error', signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(12000)]) });
      } catch { throw new ProviderError('GoFundMe Pro could not be reached or timed out. Retrying automatically.', true); }
    };
    let response = await request();
    if (response.status === 401) { refreshed = true; await this.authenticate(); response = await request(); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new ProviderError(`GoFundMe Pro authentication failed${refreshed ? ' after renewing the token' : ''}. Check organization access and reconnect.`);
      if (response.status === 429) throw new ProviderError('GoFundMe Pro is rate limiting requests. Waiting before retrying.', true, retryAfter(response.headers.get('retry-after')));
      if (response.status >= 500 || response.status === 408) throw new ProviderError('GoFundMe Pro is temporarily unavailable. Retrying automatically.', true, retryAfter(response.headers.get('retry-after')));
      if (response.status === 404) throw new ProviderError('Campaign or campaign totals not found. Check the Pro ID and organization API access.');
      throw new ProviderError(`GoFundMe Pro rejected the request (HTTP ${response.status}).`);
    }
    return this.parse(response, schema);
  }
  async getCampaign(): Promise<CampaignState> {
    const path = `/campaigns/${this.config.campaignId}`;
    const campaign = await this.get(`${path}?fields=id,name,currency_code,goal`, apiCampaign);
    if (BigInt(campaign.id) !== BigInt(this.config.campaignId)) throw new ProviderError('GoFundMe Pro returned a different campaign. Check the campaign ID.');
    const totals = await this.get(`${path}/overview`, overview);
    const goal = campaign.goal ?? 0;
    return { id: campaign.id, url: this.config.campaignUrl, title: campaign.name.slice(0, 200),
      currency: campaign.currency_code, raised: totals.total_gross_amount, goal,
      percent: percentage(totals.total_gross_amount, goal), donationCount: totals.transactions_count,
      lastUpdated: new Date().toISOString(), connected: true };
  }
  async getRecentDonations(): Promise<Donation[]> {
    const donations: Donation[] = [];
    // No undocumented ordering or filtering assumptions. Read every documented page.
    for (let page = 1; page <= 100; page++) {
      const fields = 'id,status,is_anonymous,hide_amount,member_name,raw_donation_gross_amount,raw_currency_code,purchased_at,created_at';
      const data = await this.get(`/campaigns/${this.config.campaignId}/transactions?page=${page}&per_page=100&fields=${fields}`, pageSchema);
      if (data.current_page !== page) throw new ProviderError('The transaction pagination response was inconsistent. Reconnect after the API recovers.');
      for (const value of data.data) { const donation = normalizeTransaction(value); if (donation) donations.push(donation); }
      if (page >= data.last_page) return donations;
      if (page < 100) await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }
    throw new ProviderError('This campaign exceeds the 10,000-transaction polling limit. Increase the documented scan limit or add a supported incremental provider before connecting.');
  }
}
