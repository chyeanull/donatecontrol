import { isIP } from 'node:net';
import { z } from 'zod';
import { donorDriveResourceSchema, type CampaignState, type Donation, type ProviderConfig } from '../../shared/models';
import { percentage } from '../../shared/format';
import { ProviderError, type FundraisingProvider } from './FundraisingProvider';
import { retryAfter } from './GoFundMeProProvider';

// Public API contract and polling guidance: docs/api-integration.md.
const VERSION = '1.3';
const MIN_INTERVAL = 15000;
const money = z.number().finite().nonnegative().max(1e12);
const identifier = z.number().int().positive();
const campaignResponse = z.object({
  participantID: identifier.optional(), teamID: identifier.optional(), eventID: identifier.optional(),
  displayName: z.string().optional(), campaignName: z.string().optional(), name: z.string().optional(),
  sumDonations: money, fundraisingGoal: money.nullish(), numDonations: z.number().int().nonnegative().optional(),
});
const aboutResponse = z.object({ currency: z.object({ label: z.string().regex(/^[A-Z]{3}$/) }) });
const donationResponse = z.object({
  donationID: z.string().min(1), createdDateUTC: z.string().refine((date) => Number.isFinite(Date.parse(date))),
  displayName: z.string().nullish(), amount: money.nullish(), isRegFee: z.boolean().optional(),
  message: z.string().nullish(),
});
const donationPage = z.array(donationResponse).max(100);
const idFields = { participants: 'participantID', teams: 'teamID', events: 'eventID' } as const;

export function validateDonorDriveConfig(config: ProviderConfig) {
  let url: URL;
  try { url = new URL(config.campaignUrl.trim()); }
  catch { throw new ProviderError('Enter your DonorDrive fundraising page or site URL, starting with https://.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname.replace(/[\[\]]/g, '')) ||
    !url.hostname.includes('.') || /(^|\.)(localhost|local|internal)$/.test(url.hostname)) {
    throw new ProviderError('Use a public HTTPS DonorDrive site URL without credentials or a custom port.');
  }
  const resource = donorDriveResourceSchema.parse(config.donorDriveResource ?? 'participants');
  const field = idFields[resource];
  const params = new Map([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]));
  const pathId = url.pathname.match(new RegExp(`/(?:${resource}|${resource.slice(0, -1)})/(\\d+)/?$`, 'i'))?.[1];
  const id = config.campaignId.trim() || params.get(field.toLowerCase()) || pathId || '';
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new ProviderError(`Enter the numeric DonorDrive ${field}, or paste a page URL containing it. Custom page aliases need a numeric ID.`);
  }
  return { origin: url.origin, resource, id: String(Number(id)), pageUrl: url.href };
}

function parse<T>(value: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ProviderError('DonorDrive returned an unexpected response. Last valid graphics are preserved; check the site and API compatibility.');
  return result.data;
}

export class DonorDriveProvider implements FundraisingProvider {
  private config?: ReturnType<typeof validateDonorDriveConfig>;
  private abort = new AbortController();
  private currency = '';
  private donations: Donation[] = [];
  private newestDonationAt?: number;
  private donationsDirty = true;
  private campaignFetchedAt = 0;
  private cache = new Map<string, { data: unknown; etag: string | null; fetchedAt: number }>();
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async connect(config: ProviderConfig) {
    this.config = validateDonorDriveConfig(config);
    this.abort = new AbortController();
    this.donations = []; this.newestDonationAt = undefined; this.donationsDirty = true;
    const { data } = await this.get(`${this.config.origin}/api/about`);
    this.currency = parse(data, aboutResponse).currency.label;
  }
  async disconnect() { this.abort.abort(); }

  private async get(path: string): Promise<{ data: unknown; modified: boolean; fetchedAt: number }> {
    const url = new URL(path);
    url.searchParams.set('version', VERSION);
    const key = url.href;
    const cached = this.cache.get(key);
    // Manual refreshes and reconnects also respect the per-resource minimum.
    if (cached && Date.now() - cached.fetchedAt < MIN_INTERVAL) return { data: cached.data, modified: false, fetchedAt: cached.fetchedAt };
    let response: Response;
    try {
      response = await this.fetcher(key, { headers: { Accept: 'application/json', ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}) },
        redirect: 'error', signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(12000)]) });
    } catch { throw new ProviderError('DonorDrive could not be reached or timed out. Retrying automatically.', true); }
    if (response.status === 304 && cached) {
      cached.fetchedAt = Date.now();
      return { data: cached.data, modified: false, fetchedAt: cached.fetchedAt };
    }
    if (response.status === 429) throw new ProviderError('DonorDrive is rate limiting requests. Waiting before retrying.', true, Math.max(MIN_INTERVAL, retryAfter(response.headers.get('retry-after'))));
    if (response.status >= 500 || response.status === 408) throw new ProviderError('DonorDrive is temporarily unavailable. Retrying automatically.', true, retryAfter(response.headers.get('retry-after')));
    if (response.status === 404) throw new ProviderError('DonorDrive resource not found. Check the site URL, fundraiser type, and numeric ID.');
    if (response.status === 401 || response.status === 403) throw new ProviderError('This DonorDrive resource is not publicly accessible. Check the site and fundraiser visibility.');
    if (!response.ok) throw new ProviderError(`DonorDrive rejected the request (HTTP ${response.status}). Check the site and fundraiser configuration.`);
    let data: unknown;
    try { data = response.status === 204 ? [] : await response.json(); }
    catch { throw new ProviderError('DonorDrive did not return valid JSON. Check that the URL is a DonorDrive site.'); }
    const fetchedAt = Date.now();
    if (this.cache.size >= 150) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { data, etag: response.headers.get('etag'), fetchedAt });
    return { data, modified: true, fetchedAt };
  }

  private get resourceUrl() {
    if (!this.config) throw new ProviderError('Connect a DonorDrive fundraiser first.');
    return `${this.config.origin}/api/${this.config.resource}/${this.config.id}`;
  }
  async getCampaign(): Promise<CampaignState> {
    const { data, modified, fetchedAt } = await this.get(this.resourceUrl);
    const campaign = parse(data, campaignResponse);
    const config = this.config!;
    if (String(campaign[idFields[config.resource]]) !== config.id) throw new ProviderError('DonorDrive returned a different fundraiser. Check the fundraiser type and ID.');
    const title = config.resource === 'participants' ? campaign.campaignName || campaign.displayName : campaign.name;
    if (!title?.trim()) throw new ProviderError('DonorDrive did not return a public fundraiser name.');
    this.donationsDirty ||= modified;
    this.campaignFetchedAt = fetchedAt;
    const goal = campaign.fundraisingGoal ?? 0;
    return { id: `${config.resource}/${config.id}`, url: config.pageUrl, title: title.slice(0, 200),
      currency: this.currency, raised: campaign.sumDonations, goal, percent: percentage(campaign.sumDonations, goal),
      ...(campaign.numDonations !== undefined ? { donationCount: campaign.numDonations } : {}),
      lastUpdated: new Date().toISOString(), connected: true };
  }
  async getRecentDonations(): Promise<Donation[]> {
    if (!this.donationsDirty) return this.donations;
    const incoming: Donation[] = [];
    const incomingIds = new Set<string>();
    const scanStarted = Date.now();
    let fresh = true;
    let newest: number | undefined;
    let previousTime = Infinity;
    for (let page = 0; page < 100; page++) {
      const url = new URL(`${this.resourceUrl}/donations`);
      url.searchParams.set('limit', '100'); url.searchParams.set('offset', String(page * 100));
      url.searchParams.set('orderBy', 'createdDateUTC DESC');
      const { data, fetchedAt } = await this.get(url.href);
      fresh &&= fetchedAt >= this.campaignFetchedAt;
      const values = parse(data, donationPage);
      for (const value of values) {
        const timestamp = Date.parse(value.createdDateUTC);
        if (timestamp > previousTime) throw new ProviderError('DonorDrive donation ordering changed during pagination. Retrying the complete update.', true);
        previousTime = timestamp;
        newest ??= timestamp;
        const id = `donordrive:${this.config!.origin}:${this.config!.resource}:${this.config!.id}:${value.donationID}`;
        incomingIds.add(id);
        // Omitted/null amounts are private. Never guess an amount or a donor's identity.
        if (!value.amount || value.isRegFee) continue;
        const name = value.displayName?.trim();
        incoming.push({ id,
          ...(value.message?.trim() ? { message: value.message.trim().slice(0, 2000) } : {}),
          donorName: name?.slice(0, 120) || 'Anonymous', amount: value.amount, currency: this.currency,
          timestamp: new Date(timestamp).toISOString(), anonymous: !name || name.toLowerCase() === 'anonymous' });
      }
      // Import every historical page on connect. Later changes only need to
      // scan back to the prior newest timestamp, including all ties.
      if (values.length < 100 || (this.newestDonationAt !== undefined && previousTime < this.newestDonationAt)) {
        this.donations = [...new Map([...this.donations.filter((donation) => !incomingIds.has(donation.id)), ...incoming].map((donation) => [donation.id, donation])).values()]
          .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
        this.newestDonationAt = newest ?? this.newestDonationAt ?? scanStarted;
        this.donationsDirty = !fresh;
        const result = this.donations;
        this.donations = result.slice(0, 100);
        return result;
      }
    }
    throw new ProviderError('DonorDrive reached the 10,000-record scan limit before the end of the donation list. No partial update was applied.');
  }
}
