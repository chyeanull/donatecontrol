# Official API integration notes

References inspected on October 2, 2026 and rechecked on November 3, 2026:

- [GoFundMe Pro developer portal](https://developers.gofundme.com/pro/)
- [Authentication](https://developers.gofundme.com/pro/overview/authentication) and its [published documentation content](https://developers.gofundme.com/pro/partials/getting-started/authentication.html)
- [V2 API reference](https://developers.gofundme.com/pro/docs/) and [published OpenAPI specification](https://developers.gofundme.com/pro/docs/specs/apiv2-public.json)
- [Official sample applications](https://developers.gofundme.com/pro/tutorials/samples)
- GoFundMe Pro's [progress-bar server](https://github.com/classy-org/custom-progress-bar-sample-app/blob/main/backend/src/api/campaign/campaignRouter.ts), [overview response type](https://github.com/classy-org/custom-progress-bar-sample-app/blob/main/backend/src/api/campaign/campaignModel.ts), and [sample environment](https://github.com/classy-org/custom-progress-bar-sample-app/blob/main/backend/.env.template)
- [GoFundMe's consumer live fundraising tools](https://support.gofundme.com/hc/en-us/articles/30297868605595-Amplify-your-GoFundMe-on-your-next-stream-Live-fundraising-tools-Beta) describe hosted OBS widgets; they do not document a consumer data API for this application.

## Requests actually made

| Purpose | Official request used | Fields consumed |
| --- | --- | --- |
| Application token | `POST https://api.classy.org/oauth2/auth` | `access_token`, `expires_in`, `token_type` |
| Campaign | `GET https://api.classy.org/2.0/campaigns/{id}` | `id`, `name`, `currency_code`, `goal` |
| Totals | `GET https://api.classy.org/2.0/campaigns/{id}/overview` | `total_gross_amount`, `transactions_count` |
| Donations | `GET https://api.classy.org/2.0/campaigns/{id}/transactions` | `id`, `status`, `is_anonymous`, `hide_amount`, `member_name`, `raw_donation_gross_amount`, `raw_currency_code`, `purchased_at`, `created_at` |

OAuth sends `grant_type=client_credentials`, `client_id`, and `client_secret` as form-encoded body parameters. Resource requests send `Authorization: Bearer ...`. Credentials are never URL parameters. Fetches time out after 12 seconds and reject redirects rather than risk forwarding authentication to an unexpected host.

**Reference discrepancy:** the current OpenAPI file declares `https://pro.gofundme.com/api/2.0` as its resource server and contains campaign and campaign-transaction operations. It includes a `CampaignAggregates` schema but does not expose the campaign overview operation. The developer portal's official progress-bar sample explicitly calls `/2.0/campaigns/{id}/overview` using `https://api.classy.org`, defines its response, and supplies that host in its sample environment. This provider consistently follows that official sample host and totals contract, plus the V2 campaign and transaction schemas. No guessed fallback endpoint is used. Check actual organization access before broadcasting; if GoFundMe retires the sample contract or redirects the host, the provider reports an error, hides campaign graphics, and preserves locally saved donation history.

## Mapping and privacy

Campaign goal and `currency_code` are the organization-normalized pair defined in the campaign schema. The progress-bar sample's `total_gross_amount` is used as raised, with `transactions_count` for the displayed donation count. This may include registration or other transaction totals, as the official sample does; it is not a promise to match every campaign's configurable public progress bar. Validate this choice with your campaign type before a live event.

Donation alerts use the documented raw donation amount and raw currency together, so a donor's original currency is retained. Only successful, positive donations with visible amounts become public donations. `is_anonymous` forces the name to `Anonymous` before data enters a Replicant. Absent names become `A generous donor`. Hidden amounts are omitted entirely, avoiding a public disclosure in the browser. No supporter/member expansions are requested; billing names and private contact fields are not used as a fallback.

The transaction `fields`, `page`, and `per_page` parameters come directly from the published operation. Pagination is validated and fetched in full, bounded at 100 pages. An incomplete or malformed scan commits no IDs and emits no alerts. No undocumented sort/filter parameter, ordering guarantee, or invented response envelope is assumed. Every reconnect intentionally baselines all returned donations to avoid replaying history or missed downtime donations. An older transaction that settles after the baseline with a pre-baseline purchase timestamp is conservatively suppressed as historical.

The inspected documentation does not establish a universally applicable numeric rate limit for this integration. The default interval is 15 seconds, requests run sequentially, pagination has a short inter-page delay, and server-supplied `Retry-After` takes precedence over exponential backoff. For high-volume campaigns, obtain a documented incremental query or webhook agreement from GoFundMe Pro before extending this provider. The presentation layer and alert queue do not depend on polling.

## DonorDrive Public API

References inspected October 10, 2026: [polling guidance](https://github.com/DonorDrive/PublicAPI), [overview and pagination](https://github.com/DonorDrive/PublicAPI/blob/master/overview.md), [site URL construction](https://github.com/DonorDrive/PublicAPI/blob/master/how-tos.md), [about](https://github.com/DonorDrive/PublicAPI/blob/master/resources/about.md), [participants](https://github.com/DonorDrive/PublicAPI/blob/master/resources/participants.md), [teams](https://github.com/DonorDrive/PublicAPI/blob/master/resources/teams.md), [events](https://github.com/DonorDrive/PublicAPI/blob/master/resources/events.md), and [donations](https://github.com/DonorDrive/PublicAPI/blob/master/resources/donations.md).

All requests are public GETs to the supplied site's HTTPS origin; no credentials are sent. Requests pin the documented supported `version=1.3`, which includes `/api/about`. Numeric IDs are used; alias resolution and API program-code paths are outside this integration.

| Purpose | Path | Mapping |
| --- | --- | --- |
| Currency | `/api/about` | `currency.label` |
| Fundraiser | `/api/{participants\|teams\|events}/{id}` | `sumDonations`, `fundraisingGoal`, optional `numDonations`; participant `campaignName`/`displayName`, team/event `name` |
| Donations | `/api/{participants\|teams\|events}/{id}/donations` | `donationID`, `createdDateUTC`, public `displayName`, public `amount`, `isRegFee` |

The provider verifies the response ID and required total instead of silently substituting zero. A missing goal becomes zero. Donation IDs are scoped to site, resource type, and ID. Omitted/null names become Anonymous, private amounts are skipped, and registration fees do not alert. No donor profiles or private identity fallbacks are requested.

Polling enforces a 15-second minimum and caches individual resources for that period, including manual refresh and immediate reconnect. Requests use ETag/If-None-Match when supplied. A changed fundraiser triggers donation reads; a 304 keeps existing donations. Failed donation reads remain pending even if the next fundraiser response is 304. Transient failures and 429 responses use the shared backoff and Retry-After handling.

Donations use documented `limit=100`, zero-based `offset`, and `orderBy=createdDateUTC DESC`. The initial scan imports every page into the local donation archive and establishes a baseline without playing historical alerts. Subsequent changes scan through the prior newest timestamp, including ties and bursts spanning pages. Scans stop with a clear error after 100 full pages instead of committing a partial result. The existing persistent ledger suppresses duplicates and historical alerts; reconnect deliberately establishes a fresh baseline.

Contract tests use documented fixtures for all three fundraiser types, privacy, pagination, empty history, ETags, failures, and throttling. The public test site's `/api/about` responded successfully during verification; its old example participant IDs returned 404. A real fundraiser still needs its current site URL and ID to verify access before broadcast.

## Givebutter API

References inspected October 11, 2026: [authentication](https://docs.givebutter.com/api-reference/authentication), [Get a campaign](https://docs.givebutter.com/api-reference/campaigns/get-a-campaign), [List all transactions](https://docs.givebutter.com/api-reference/transactions/list-all-transactions), [pagination](https://docs.givebutter.com/api-reference/pagination), [rate limits](https://docs.givebutter.com/api-reference/rate-limits), the [official OpenAPI specification](https://givebutter.com/docs/api.json), and [official transaction webhook examples](https://help.givebutter.com/en/articles/8828428-how-to-automate-workflows-and-data-using-webhooks).

All requests are server-side GETs to `https://api.givebutter.com/v1` with `Authorization: Bearer <key>`. Redirects are rejected, requests time out after 12 seconds, and API error bodies are not published. Only non-secret key configuration status enters a Replicant.

| Purpose | Path | Fields consumed |
| --- | --- | --- |
| Resolve campaign URL/code | `/campaigns?page=N&per_page=100` | `id`, `code`, `url` |
| Campaign and thermometer | `/campaigns/{id}` | `id`, `title`, `url`, `raised`, `goal`, `currency` |
| Donations | `/transactions?page=N&per_page=100&sortByDesc=created_at` | `id`, `campaign_id`, `status`, `currency`, `transacted_at`, `giving_space.name`, `giving_space.amount` |

Campaign detail is an unwrapped object; lists have `data` and `meta.current_page/last_page`. Numeric and string IDs are accepted, matching the published schemas and examples. Amounts are currency units, not integer cents. A missing goal becomes zero. `donors` counts unique donors and is deliberately not mapped to donation count.

The current published list-transactions operation has no campaign filter, so campaign IDs are filtered locally. Only `succeeded` transactions with positive public supporter-feed amounts are retained. Missing/null `giving_space` or amount is omitted; missing public names become Anonymous. Administrative names, billing amounts, emails, and other private response fields are discarded before publication. No private-field fallback is used.

Numeric campaign IDs avoid account lookup. Public campaign slugs/codes are resolved through at most 100 campaign pages. Donation polls scan complete account transaction history up to 100 pages of 100 records; an overflow, invalid page, or malformed response commits no partial snapshot. All requests have at least 150 ms spacing, below the documented 500 requests/minute ceiling, with shared exponential backoff and `Retry-After` handling. Reconnect establishes a fresh baseline and does not replay historical donations. The baseline cutoff uses the start of its scan, so an unseen donation arriving during the scan can be picked up by the next poll.

This is polling, not a webhook receiver; no public callback service is needed. Tests use documented response fixtures. Actual account permissions and live campaign data must be verified using an operator-supplied key.

## Public donation messages

Donation messages are optional, trimmed, and limited to 2,000 characters in the shared donation state; the alert wraps the complete message and scales its card to fit the 1000 × 250 source without line clamping or clipping. React renders messages as text, never HTML. Empty, missing, and null provider messages produce no message row. Messages remain attached when donations are resent.

DonorDrive uses the public `message` field documented in [Donations](https://github.com/DonorDrive/PublicAPI/blob/master/resources/donations.md), which respects donor privacy. Givebutter uses only `giving_space.message` from the [official schema](https://givebutter.com/docs/api.json); private transaction notes are not used. GoFundMe Pro's transaction `comment` is documented as an organization comment, not a public donor message, and is deliberately not mapped. Mock donations accept an optional message in the demo playground. Dashboard and positioning previews include a sample message.

## Verification update — November 3, 2026

See [Provider verification](provider-verification.md) for the tested feature matrix, live versus simulated evidence, fixes, and remaining limits. Givebutter’s current OpenAPI permits a receipt-only TransactionResource variant without campaign/public supporter data; those validated records are omitted instead of rejecting the entire donation poll. GoFundMe Pro campaign responses are checked against the requested numeric ID.
