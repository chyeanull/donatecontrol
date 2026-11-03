# Provider verification — November 3, 2026

The configured DonorDrive event passed a live, read-only API check. GoFundMe Pro and Givebutter were checked against current official documentation and exercised through their real adapters using simulated HTTP responses. They were not authenticated against a live organization/account. No real donations were submitted.

Tests ran in a separate NodeCG instance on localhost:9092, with its own database, build, sound assets and fixture credentials. The production dashboard on localhost:9090 was not used to inject test donations.

## Findings and fixes

- **DonorDrive history was truncated at connection.** It imported only the latest 100 records. The adapter now paginates the initial donation list before committing it. Later polls retain the existing incremental catch-up behavior. The bounded scan still fails explicitly at its limit instead of applying partial history.
- **An arrival during the initial scan could miss automatic playback.** The cutoff previously used the end of the baseline scan. It now uses the start, allowing a donation absent from the initial snapshot but received during that scan to alert when the next poll finds it. Historical donations included in the baseline still do not play.
- **GoFundMe Pro accepted mismatched campaign responses.** The adapter now verifies the returned ID, including numeric equivalence for IDs with leading zeros.
- **Givebutter's documented alternate transaction shape rejected the entire list.** The OpenAPI `TransactionResource` permits records containing receipt details without campaign, currency, status or public supporter-feed data. Those records are now validated and omitted from alerts; regular public campaign transactions continue through the normal pipeline. Malformed campaign records still fail validation.

## API contract review

| Area | GoFundMe Pro | Givebutter | DonorDrive |
| --- | --- | --- | --- |
| Authentication | OAuth client credentials; cached token; expiry/401 renewal | Server-side Bearer API key | Public HTTPS GET; no credentials |
| Campaign lookup | Organization's numeric Pro/Classy campaign ID | Numeric ID or campaign URL/code resolved through account campaigns | Numeric participant, team or event ID on its site |
| Existing donations | Paginated campaign transactions | Paginated account transactions filtered to campaign | Paginated public resource donations |
| New donations | Repeated transaction scans | Repeated transaction scans | ETag-aware fundraiser polls and donation catch-up |
| Raised/goal | Campaign goal/currency + official overview totals | Campaign raised/goal/currency | Resource sumDonations/fundraisingGoal + site currency |
| Public names/amounts | Anonymous and hidden-amount flags respected | Only public giving_space fields | Only public displayName/amount fields |
| Public donor message | No documented public message mapped | giving_space.message | message |
| Producer edits/reset/replay | Local app features; no provider writes | Local app features; no provider writes | Local app features; no provider writes |

GoFundMe Pro's transaction `comment` is documented as an organization comment, so it is not imported as a donor message. Producers can add local alert text. [Official Pro schema](https://developers.gofundme.com/pro/docs/specs/apiv2-public.json).

The Pro overview URL follows GoFundMe's official progress-bar sample. The current OpenAPI declares a different resource-server hostname and does not list that overview operation; this remains a real-account compatibility check, not proof of a live connection. Its gross-total definition can include more than public donations. [Official progress-bar sample](https://github.com/classy-org/custom-progress-bar-sample-app/blob/main/backend/src/api/campaign/campaignRouter.ts), [response model](https://github.com/classy-org/custom-progress-bar-sample-app/blob/main/backend/src/api/campaign/campaignModel.ts).

Givebutter's campaign endpoint supplies raised/goal/currency; its list endpoint supplies the public supporter feed within regular transaction records. `donors` means unique donors, so the app does not mislabel it as donation count. [Campaign API](https://docs.givebutter.com/api-reference/campaigns/get-a-campaign), [transaction API](https://docs.givebutter.com/api-reference/transactions/list-all-transactions), [official OpenAPI](https://givebutter.com/docs/api.json).

## Verification results

- **118 automated tests pass across 13 files**, including 33 added regressions/integration cases; TypeScript validation and production build pass.
- Browser workflows passed for **GoFundMe Pro**, **Givebutter**, and DonorDrive **participant**, **team**, and **event** configurations. Each imported 106 eligible historical records across multiple API pages, detected two scheduled incoming donations, checked automatic/manual send counts, edited/reset/resubmitted an alert, updated the thermometer, exercised all three themes, and disconnected/reconnected through campaign history. No browser page exceptions were observed.
- A real restart preserved the isolated 324-record DonorDrive archive and its send counts/settings. Reconnection produced no historical alerts.
- Sound upload, preview/stop, unsaved preview volume, file removal, playback-error toasts, and small-screen layout checks passed. The actual alert graphic played an uploaded WAV at the saved volume and stopped it on exit. Mock/Demo donations updated totals; test alerts did not. Givebutter receipt-only records, a denied-access toast, data hiding, archive preservation, and reconnect recovery also passed in the browser.

## Test coverage

- More than 100 existing donations, pagination, anonymous donors, hidden amounts, registration fees/failed payments, and unrelated Givebutter campaigns.
- Real provider adapters through CampaignService, validated Replicants, durable archive, and AlertQueue; no mocking of the adapter methods in the new integration tests.
- Existing donations start at sent count zero and do not automatically replay on connect.
- Scheduled polling, repeated IDs, more-than-one-page bursts, and empty initial histories.
- Automatic alerting, manual holding, switching modes, producer edits, original-content reset, repeated sends, and send counts at playback start.
- Provider-reported totals, currency, missing goals, goals exceeded, and unchanged totals during replay/test alerts.
- No partial state after a failed page; HTTP 429 Retry-After; automatic recovery; terminal HTTP 403; failed initial connection recovery.
- Campaign history, disconnect/reconnect, all three overlay themes, and disconnected data hiding.
- Existing tests additionally cover credentials, sound upload/validation, legacy settings, preview controls, and animation duration/entry/exit timing.

The regression suite can be run with `npm test`; type validation with `npm run typecheck`. New integration tests are in `tests/providerFlows.test.ts`, with HTTP fixtures in `tests/helpers/providerFixture.ts`. Givebutter's alternate response has a regression in `tests/givebutter.test.ts`.

## Live check

The actual configured DonorDrive event (events/508) returned HTTP 200 for site currency, campaign, and donations: USD 5 raised, USD 5,000 goal, 0.1%, one public donation. ETags were present. No live incoming donation occurred during this read, so arrival monitoring was tested with controlled fixtures. Participant/team discovery for this particular event returned HTTP 401; their adapters were exercised with documented fixtures, not claimed as live verified.

The verified changes were applied to the main project. Its existing campaign connection was restored after restart, its saved donation archive and settings matched their pre-update fingerprints, and the actual thermometer matched the live provider total. The isolated test server was stopped afterward.

## Practical limits

- Historical records are saved for manual sending; connecting/reconnecting does not automatically replay history or donations missed during downtime.
- Pro/Givebutter payments with a purchase/transaction timestamp older than the connection cutoff that settle later are saved but held for manual sending. A regression test documents this conservative behavior.
- The scan ceiling is 100 pages. Pro/Givebutter use 100 records/page; Givebutter scans account-wide transaction history. DonorDrive fails if 100 full pages do not establish the end or the previous catch-up boundary. Very large campaigns/accounts need a supported incremental strategy before relying on this app.
- Only eligible public donations appear. Hidden amounts, nonpublic supporter records, failed/refunded payments and registration fees are excluded by provider-specific rules. The archive is an append-only record of public donations received by the app, not a reconciliation of later provider deletions or refunds. Totals always come from the provider.
- Polling is not instantaneous. Arrival latency includes the configured interval, API duration, and any rate-limit backoff. DonorDrive enforces at least 15 seconds; Givebutter spaces requests and respects its 500 requests/minute limit. [DonorDrive guidance](https://github.com/DonorDrive/PublicAPI), [Givebutter limits](https://docs.givebutter.com/api-reference/rate-limits).
- A provider error hides campaign graphics and stops playback. Pending donations remain saved and unsent for producer review; they are not silently marked sent. Send counts record playback starts on the app's stream feed, not a receipt that OBS was open or rendered it.
- Actual Pro permissions, Givebutter account access, live settlement timing, and physical OBS audio/video output were not validated with real authenticated accounts/OBS.
