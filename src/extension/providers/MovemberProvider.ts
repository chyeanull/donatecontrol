import { setTimeout as pause } from 'node:timers/promises';
import { z } from 'zod';
import type { CampaignState, Donation, ProviderConfig } from '../../shared/models';
import { percentage } from '../../shared/format';
import { ProviderError, type FundraisingProvider } from './FundraisingProvider';
import { retryAfter } from './GoFundMeProProvider';

// Public responses verified against Movember's Mo Space website. See docs/api-integration.md.
const API = 'https://api.movember.com/v18';
const MIN_INTERVAL = 15000;
const id = z.union([z.string().regex(/^\d+$/), z.number().int().positive()])
  .transform(String).refine((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0)
  .transform((value) => String(Number(value)));
const money = z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
  .transform(Number).pipe(z.number().finite().nonnegative().max(1e12));
const currency = z.string().regex(/^[A-Z]{3}$/);
// The feed omits the zone. Its values match the public page's UTC Unix timestamps.
const timestamp = z.string().transform((value) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
  ? `${value.replace(' ', 'T')}Z` : value).pipe(z.iso.datetime({ offset: true }))
  .transform((value) => new Date(value).toISOString());
const memberResponse = z.object({
  id, entityType: z.literal('member'), fullName: z.string().trim().min(1),
  visibility: z.literal('public'), countryCode: z.string().regex(/^[a-z]{2}$/), currencyCode: currency,
  targetAmount: money.nullish(), AmountRaised: z.object({ originalAmount: money, originalCurrencyCode: currency }),
});
const configurationResponse = z.object({ country: z.string(), campaign: z.object({ current: z.object({
  year: z.string().regex(/^\d{4}$/), campaignStart: timestamp, campaignEnd: timestamp,
}) }) });
const feedResponse = z.array(z.object({
  id, created: timestamp, viewtype: z.string(), isHidden: z.boolean(), metadata: z.unknown(),
  entity: z.object({ id, type: z.string() }),
})).max(90);
const donationMetadata = z.object({
  id, anonymous: z.boolean(), show: z.boolean(), show_message: z.boolean(), is_current_campaign: z.boolean(),
  amount: z.unknown(), currency: z.unknown(), message: z.unknown(), donor: z.unknown(),
});
const publicDonation = z.object({ amount: money, currency, donor: z.object({ name: z.string().nullish() }).nullish() });
type Season = z.infer<typeof configurationResponse>['campaign']['current'];

function parse<T>(value: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ProviderError('Movember returned an unexpected public response. Check the Mo Space and API compatibility; no partial update was applied.');
  return result.data;
}

export function validateMovemberConfig(config: ProviderConfig) {
  let reference = config.campaignId.trim();
  if (config.campaignUrl.trim()) {
    let url: URL;
    try { url = new URL(config.campaignUrl.trim()); }
    catch { throw new ProviderError('Enter a complete Movember Mo Space or donation-feed URL, or its numeric member ID.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !/^(?:(?:[a-z]{2}|www|api)\.)?movember\.com$/.test(url.hostname)) {
      throw new ProviderError('Use a public HTTPS Movember URL without credentials or a custom port.');
    }
    let urlId: string | undefined;
    if (url.hostname === 'api.movember.com') {
      if (!/^\/v\d+\/newsfeed\/?$/.test(url.pathname) || url.searchParams.get('entity_type') !== '0' ||
        (url.searchParams.has('filter_type') && url.searchParams.get('filter_type') !== 'donation')) {
        throw new ProviderError('Use a Movember member donation feed with entity_type=0 and filter_type=donation. Team and network feeds are not supported yet.');
      }
      urlId = url.searchParams.get('entity_id') ?? '';
    } else {
      const pathId = url.pathname.match(/^\/(?:[a-z]{2}\/)?mospace\/(\d+)\/?$/)?.[1];
      if (pathId) urlId = pathId;
      else if (!/^\/m\/[^/]+\/?$/.test(url.pathname) || !reference) {
        throw new ProviderError('Use a personal Movember /mospace/NUMBER page. Custom /m/ links also need the numeric member ID; team and network pages are not supported yet.');
      }
    }
    if (urlId !== undefined) {
      const parsed = id.safeParse(urlId);
      if (!parsed.success) throw new ProviderError('Enter a valid numeric Movember member ID.');
      if (reference && Number(reference) !== Number(parsed.data)) throw new ProviderError('The Movember URL and member ID refer to different fundraisers. Use matching values.');
      reference = parsed.data;
    }
  }
  const parsed = id.safeParse(reference);
  if (!parsed.success) throw new ProviderError('Enter a valid numeric Movember member ID or a Mo Space URL containing it.');
  return parsed.data;
}

export class MovemberProvider implements FundraisingProvider {
  private abort = new AbortController();
  private memberId = '';
  private nextRequest = 0;
  private configuration?: { country: string; season: Season; expiresAt: number };
  private pending?: { campaign: CampaignState; season: Season };
  private campaign?: CampaignState;
  private year = '';
  private newestAt?: number;
  private recent: Donation[] = [];
  private lastSuccess = 0;
  private cached = false;
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async connect(config: ProviderConfig) {
    this.memberId = validateMovemberConfig(config);
    this.abort = new AbortController();
    this.configuration = undefined; this.pending = undefined; this.campaign = undefined;
    this.year = ''; this.newestAt = undefined; this.recent = []; this.lastSuccess = 0; this.cached = false;
  }
  async disconnect() { this.abort.abort(); }

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
      const wait = this.nextRequest - Date.now();
      if (wait > 0) await pause(wait, undefined, { signal: this.abort.signal });
      this.nextRequest = Date.now() + 250;
      response = await this.fetcher(`${API}${path}`, { headers: { Accept: 'application/json' }, redirect: 'error',
        signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(12000)]) });
    } catch { throw new ProviderError('Movember could not be reached or timed out. Retrying automatically.', true); }
    if (response.status === 429) throw new ProviderError('Movember is rate limiting requests. Waiting before retrying.', true, Math.max(MIN_INTERVAL, retryAfter(response.headers.get('retry-after'))));
    if (response.status >= 500 || response.status === 408) throw new ProviderError('Movember is temporarily unavailable. Retrying automatically.', true, retryAfter(response.headers.get('retry-after')));
    if (response.status === 401 || response.status === 403) throw new ProviderError('This Movember Mo Space is not publicly accessible. Check its visibility and member ID.');
    if (response.status === 404) throw new ProviderError('Movember Mo Space not found. Check the numeric member ID.');
    if (!response.ok) throw new ProviderError(`Movember rejected the request (HTTP ${response.status}). Check the Mo Space URL and member ID.`);
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new ProviderError('Movember did not return valid JSON. No partial update was applied.'); }
    return parse(data, schema);
  }

  async getCampaign(): Promise<CampaignState> {
    if (!this.memberId) throw new ProviderError('Connect a Movember Mo Space first.');
    this.cached = Boolean(this.campaign && Date.now() - this.lastSuccess < MIN_INTERVAL);
    if (this.cached) return this.campaign!;
    const member = await this.get(`/member/${this.memberId}`, memberResponse);
    if (member.id !== this.memberId) throw new ProviderError('Movember returned a different member. Check the Mo Space ID.');
    if (member.currencyCode !== member.AmountRaised.originalCurrencyCode) throw new ProviderError('Movember returned inconsistent campaign currencies. No partial update was applied.');
    if (!this.configuration || this.configuration.country !== member.countryCode || Date.now() >= this.configuration.expiresAt) {
      const config = await this.get(`/configuration?countryCode=${member.countryCode}`, configurationResponse);
      const season = config.campaign.current;
      if (config.country !== member.countryCode || season.campaignStart >= season.campaignEnd) {
        throw new ProviderError('Movember returned inconsistent campaign dates or country. No partial update was applied.');
      }
      this.configuration = { country: member.countryCode, season,
        expiresAt: Math.min(Date.now() + 3600000, Date.parse(season.campaignEnd) + 1) };
    }
    const season = this.configuration.season;
    const raised = member.AmountRaised.originalAmount;
    const goal = member.targetAmount ?? 0;
    const campaign: CampaignState = { id: `member/${this.memberId}/${season.year}`,
      url: `https://${member.countryCode}.movember.com/mospace/${this.memberId}`, title: member.fullName.slice(0, 200),
      currency: member.currencyCode, raised, goal, percent: percentage(raised, goal), connected: true, lastUpdated: new Date().toISOString() };
    this.pending = { campaign, season };
    return campaign;
  }

  async getRecentDonations(): Promise<Donation[]> {
    if (this.cached) return this.recent;
    if (!this.pending) throw new ProviderError('Load the Movember campaign before requesting donations.');
    const { campaign, season } = this.pending;
    const sameYear = this.year === season.year;
    const watermark = sameYear ? this.newestAt : undefined;
    const incoming = new Map<string, Donation>();
    const touched = new Set<string>();
    const seenPosts = new Set<string>();
    const scanStarted = Math.floor(Date.now() / 1000) * 1000;
    const start = Date.parse(season.campaignStart), end = Date.parse(season.campaignEnd);
    let cursor: number | undefined;
    let pageLimit = 30;
    let newest: number | undefined;
    for (let page = 0; page < 100; page++) {
      const query = new URLSearchParams({ entity_type: '0', entity_id: this.memberId, filter_type: 'donation', limit: String(pageLimit) });
      if (cursor !== undefined) query.set('before_date', new Date(cursor).toISOString().slice(0, 19).replace('T', ' '));
      const values = await this.get(`/newsfeed/?${query}`, feedResponse);
      let previous = Infinity;
      let oldest = Infinity;
      let newPosts = 0;
      for (const item of values) {
        const at = Date.parse(item.created);
        if (at > previous || (cursor !== undefined && at >= cursor)) {
          throw new ProviderError('Movember donation ordering changed during pagination. Retrying the complete update.', true);
        }
        previous = at; oldest = at;
        if (!seenPosts.has(item.id)) newPosts++;
        seenPosts.add(item.id);
        if (item.entity.id !== this.memberId || item.entity.type !== 'member') throw new ProviderError('Movember returned donations for a different fundraiser. No partial update was applied.');
        if (item.viewtype !== 'donation' || at < start || at > end) continue;
        newest = Math.max(newest ?? at, at);
        const metadata = parse(item.metadata, donationMetadata);
        const donationId = `movember:${campaign.id}:${metadata.id}`;
        touched.add(donationId);
        if (item.isHidden || !metadata.show || !metadata.is_current_campaign) continue;
        const publicValue = parse(metadata, publicDonation);
        if (!publicValue.amount) continue;
        const name = metadata.anonymous ? '' : publicValue.donor?.name?.trim();
        const message = metadata.show_message ? parse(metadata.message, z.string().nullish())?.trim() : undefined;
        incoming.set(donationId, { id: donationId, donorName: name?.slice(0, 120) || 'Anonymous',
          anonymous: !name || name.toLowerCase() === 'anonymous', amount: publicValue.amount, currency: publicValue.currency,
          timestamp: item.created, ...(message ? { message: message.slice(0, 2000) } : {}) });
      }
      if (seenPosts.size > 10000) throw new ProviderError('Movember exceeded the 10,000-record scan limit. No partial update was applied.');
      if (values.length > pageLimit) throw new ProviderError('Movember returned an unexpected page size. No partial update was applied.');
      if (values.length < pageLimit || oldest < start || (watermark !== undefined && oldest < watermark)) {
        const result = [...new Map([...(sameYear ? this.recent : []).filter((donation) => !touched.has(donation.id)), ...incoming.values()]
          .map((donation) => [donation.id, donation])).values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
        this.recent = result.slice(0, 100); this.campaign = campaign; this.year = season.year;
        this.newestAt = newest ?? (sameYear ? this.newestAt : undefined) ?? scanStarted; this.lastSuccess = Date.now();
        return result;
      }
      // Overlap the final second so simultaneous donations at a page boundary
      // are not silently skipped. Stop if the API cannot move past that second.
      const next = oldest + 1000;
      if (!newPosts || (cursor !== undefined && next >= cursor)) {
        if (pageLimit < 90) { pageLimit = 90; continue; }
        throw new ProviderError('Movember cannot advance past donations sharing the same timestamp. The feed may be truncated; no partial update was applied.');
      }
      cursor = next;
    }
    throw new ProviderError('Movember reached the 100-page scan limit before donation history was complete. No partial update was applied.');
  }
}
