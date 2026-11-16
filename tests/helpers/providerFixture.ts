import type { SettingsState } from '../../src/shared/models';
type ProviderKind = SettingsState['provider'];
type DonorDriveResource = NonNullable<SettingsState['donorDriveResource']>;

// Documented public API response shapes. The real adapters and CampaignService
// consume these responses; only the HTTP transport is replaced in the tests.
export type FixtureProvider = Exclude<ProviderKind, 'mock' | 'movember'>;
export interface FixtureDonation {
  id: string; name: string | null; amount: number | null; timestamp: string;
  message?: string; hidden?: boolean; failed?: boolean; otherCampaign?: boolean;
}
export function providerFixture(kind: FixtureProvider, resource: DonorDriveResource = 'events') {
  const state = {
    kind, resource, id: '42', title: `${kind} test campaign`, raised: 250, goal: 1000 as number | null,
    currency: 'USD', donations: [] as FixtureDonation[], revision: 1,
    error: null as null | { status: number; path: string; retryAfter?: string; page?: number },
    wrongId: false,
  };
  const requests: { path: string; page: number; authorization: boolean; at: number }[] = [];
  const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), {status,headers});
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const page = Number(url.searchParams.get('page') || Number(url.searchParams.get('offset') || 0) / 100 + 1);
    const headers = new Headers(init?.headers);
    requests.push({path,page,authorization:headers.has('Authorization'),at:Date.now()});
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (state.error && path.includes(state.error.path) && (!state.error.page || page === state.error.page)) {
      return json({error:'PRIVATE ERROR BODY'},state.error.status,{'Retry-After':state.error.retryAfter || '0'});
    }
    const id = state.wrongId ? '999' : state.id;
    if (url.hostname === 'api.classy.org') {
      if (path === '/oauth2/auth') return json({access_token:'fixture-token',expires_in:3600,token_type:'bearer'});
      if (!headers.has('Authorization')) return json({},401);
      if (path.endsWith('/overview')) return json({total_gross_amount:state.raised,transactions_count:state.donations.length});
      if (!path.endsWith('/transactions')) return json({id,name:state.title,currency_code:state.currency,goal:state.goal});
    } else if (url.hostname === 'api.givebutter.com') {
      if (!headers.has('Authorization')) return json({},401);
      const campaign = {id,code:'fixture-code',title:state.title,url:'https://givebutter.com/fixture-campaign',raised:state.raised,goal:state.goal,currency:state.currency};
      if (path === '/v1/campaigns') return json({data:[campaign],meta:{current_page:page,last_page:1}});
      if (!path.endsWith('/transactions')) return json(campaign);
    } else if (url.hostname === 'fixture.donordrive.com') {
      if (headers.has('Authorization')) throw new Error('Credentials sent to a public API');
      if (path === '/api/about') return json({currency:{label:state.currency}});
      if (!path.endsWith('/donations')) {
        const etag = `"campaign-${state.revision}"`;
        if (headers.get('if-none-match') === etag) return new Response(null,{status:304,headers:{ETag:etag}});
        return json({[`${resource.slice(0,-1)}ID`]:Number(id),displayName:state.title,name:state.title,
          sumDonations:state.raised,fundraisingGoal:state.goal,numDonations:state.donations.length},200,{ETag:etag});
      }
    } else throw new Error(`Unexpected fixture host: ${url.hostname}`);
    const ordered = [...state.donations].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
    const data = ordered.slice((page-1)*100,page*100).map(d => {
      if (kind === 'donordrive') return {donationID:d.id,displayName:d.name,amount:d.hidden?null:d.amount,
        createdDateUTC:d.timestamp,message:d.message,isRegFee:d.failed};
      if (kind === 'gofundme-pro') return {id:d.id,status:d.failed?'failed':'success',is_anonymous:!d.name,hide_amount:!!d.hidden,
        member_name:d.name || 'PRIVATE BILLING NAME',raw_donation_gross_amount:d.amount,raw_currency_code:state.currency,
        purchased_at:d.timestamp,created_at:d.timestamp,comment:'PRIVATE ORGANIZATION NOTE'};
      return {id:d.id,campaign_id:d.otherCampaign?'99':state.id,status:d.failed?'pending':'succeeded',currency:state.currency,
        transacted_at:d.timestamp,giving_space:{name:d.name,amount:d.hidden?null:d.amount,message:d.message},
        first_name:'PRIVATE BILLING NAME',email:'private@example.com',internal_note:'PRIVATE ORGANIZATION NOTE'};
    });
    if (kind === 'donordrive') return data.length ? json(data) : new Response(null,{status:204});
    const pagination = {current_page:page,last_page:Math.max(1,Math.ceil(ordered.length/100))};
    return json(kind === 'givebutter' ? {data,meta:pagination} : {data,...pagination});
  };
  const add = (id: string, timestamp: string, extra: Partial<FixtureDonation> = {}) => {
    state.donations.push({id,timestamp,name:`Donor ${id}`,amount:10,message:'Public donor message',...extra});
    state.revision++;
  };
  return {state,requests,fetcher,add};
}
