// Synthetic versions of the public v18 responses observed on 2026-11-16.
// Never copy real member profiles or donor records into fixtures.
export function movemberDonation(id: number, created = '2026-11-15 12:00:00') {
  return { id: String(id + 10000), created, viewtype: 'donation', isHidden: false, pageSize: '30',
    entity: { id: '42', type: 'member' },
    metadata: { id: String(id), currency: 'USD', amount: '10.00', anonymous: false, show: true,
      show_message: true, is_current_campaign: true, message: 'Public donation message', donor: { name: `Donor ${id}` },
      raw: { private: 'PRIVATE METADATA' } }, author: { name: 'PRIVATE AUTHOR FALLBACK' } };
}

export function movemberFixture() {
  const member = { id: 42, entityType: 'member', fullName: 'Test Mo Space', visibility: 'public',
    countryCode: 'us', currencyCode: 'USD', targetAmount: '1000',
    AmountRaised: { originalAmount: '250.00', originalCurrencyCode: 'USD', convertedAmount: '350.00', convertedCurrencyCode: 'AUD' },
    email: 'private@example.com', contactId: 999 };
  const configuration = { country: 'us', campaign: { current: {
    year: '2026', campaignStart: '2026-01-01 08:00:00', campaignEnd: '2027-01-01 07:59:59',
  } } };
  const state = { member, configuration, donations: [] as ReturnType<typeof movemberDonation>[],
    error: null as null | { path: string; status: number; page?: number; retryAfter?: string },
    ignoreCursor: false, feedPage: 0 };
  const requests: { url: URL; headers: Headers; signal?: AbortSignal | null }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://api.movember.com') throw new Error('Unexpected host');
    requests.push({ url, headers: new Headers(init?.headers), signal: init?.signal });
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (url.pathname.includes('/member/')) state.feedPage = 0;
    if (url.pathname.includes('/newsfeed/')) state.feedPage++;
    const json = (value: unknown, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
    if (state.error && url.pathname.includes(state.error.path) && (!state.error.page || state.error.page === state.feedPage)) {
      return json({ private: 'PRIVATE ERROR DETAIL' }, state.error.status, { 'Retry-After': state.error.retryAfter ?? '0' });
    }
    if (url.pathname === '/v18/member/42') return json(state.member);
    if (url.pathname === '/v18/configuration') return json(state.configuration);
    if (url.pathname !== '/v18/newsfeed/') throw new Error(`Unexpected fixture path: ${url.pathname}`);
    const before = state.ignoreCursor ? null : url.searchParams.get('before_date');
    // The public endpoint caps requests at 90, even when limit=300 is requested.
    const limit = Math.min(90, Number(url.searchParams.get('limit') ?? '20'));
    return json(state.donations.filter((entry) => !before || entry.created < before)
      .sort((a, b) => b.created.localeCompare(a.created) || Number(b.id) - Number(a.id)).slice(0, limit));
  };
  return { state, requests, fetcher };
}
