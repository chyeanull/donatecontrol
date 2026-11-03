# DONATECONTROL — agent context

Maintainer: [Robert Hilsky](https://roberthilsky.com). Read this before changing product behavior. This document preserves the detailed setup, feature behavior, architecture, and integration limits formerly in the README. Keep it current as the app changes; the README stays a short installation and features overview.

A local NodeCG broadcast studio with a React control panel, transparent fundraising thermometer, and queued donation alerts for OBS. Supports GoFundMe Pro / Classy, DonorDrive, Givebutter, and Mock / Demo. The bundle is named `gofundme-live`. Mock mode works without an account or credentials.

## Install and run

Use **Node.js 22.12 or newer** (Node 22 LTS recommended) and npm.

```bash
npm install
cp cfg/nodecg.example.json cfg/nodecg.json
npm run dev
```

Open **http://localhost:9090/dashboard/**. The root http://localhost:9090 redirects to the dashboard. Use the **Main**, **Your overlays**, **Alert Settings**, and **Donation List & Alerts** tabs at the top of NodeCG. **Main** is the default workspace.

`dev` builds the React pages, extension, and Replicant schemas, starts NodeCG, and rebuilds/restarts on changes under `src/`. Refresh browser pages after a rebuild and reconnect the campaign. Configuration, build scripts, and `.env` changes require restarting `dev`. This intentionally serves everything through NodeCG; there is no separate Vite web server.

For a broadcast, use the built application without file watching:

```bash
npm run build
npx nodecg start
```

`npm start` is equivalent to `npx nodecg start`. Leave it running throughout the stream. Stop with Ctrl+C.

NodeCG **2.8.0** is pinned as a dependency; `bundles/gofundme-live/` contains the bundle. This follows NodeCG's [documented dependency installation](https://www.nodecg.dev/docs/installing-new/), which NodeCG still labels experimental. The dependency setup and CLI are verified with this pinned version. No global CLI or separate NodeCG checkout is needed.

## Control panel tabs and themes

The control panel follows the attached [ESportsArena design system](design.md): compact black surfaces, red and blue accents, Anton headings, Inter body text, and JetBrains Mono for statistics, URLs, and timestamps. Dashboard and preset-theme fonts are bundled locally. The Custom theme loads its selected font from Google Fonts and needs internet access; a sans-serif fallback keeps text visible if the font cannot load.

- **Main:** always-open provider connection and credentials on the left, an attached grey campaign overview on the right when connected, saved connection history on the right when disconnected, and an event log. Successful connections are saved locally, newest first. While disconnected, choose a history entry to prefill its provider and campaign fields, then click **Connect**. The history disappears while connecting and is replaced by the campaign overview on success; failed connections bring the history back.
- **Your overlays:** thermometer and alert previews, OBS URLs and dimensions, themes and animations, on-stream test alerts, positioning tests, and connected Mock / Demo tools.
- **Alert Settings:** alert timing, polling interval, sound upload/volume settings, and a local sound test.
- **Donation List & Alerts:** compact manual alert control with its current mode and explanation alongside it, locally saved donations for the connected campaign, editable donor names and messages, send/replay controls, and send counts.

These are four native, full-page NodeCG workspaces ordered left to right: **01 · Main → 02 · Your overlays → 03 · Alert Settings → 04 · Donation List & Alerts**. The build generates their labels and order from the same definition used by standalone navigation. Standalone panel URLs also provide navigation between pages. Existing `control.html` bookmarks continue to open Main. Restart NodeCG once after upgrading so it discovers the new tabs, then refresh the dashboard.

In **Your overlays**, select **Custom**, **Quest**, or **BWF** to preview both graphics, then click **Apply to overlays**. Previews and animation tests work before connecting a provider, using clearly labeled sample data. **Custom** (previously Classic) includes a Google Font dropdown, plus font, accent, and background colors with color pickers and six-digit hex inputs; border size from 0–10 whole pixels; rounded or straight corners. **Show icon** and the icon picker are available for every theme and share one setting across Custom, Quest, and BWF, on both overlays. Choose from Heart, Happy face, Gift, Praying hands, Giving hand, Handshake, Star, Ribbon, Coin, and Sprout. A zero border is borderless; hiding the icon removes its space from the alert layout. Font, color, border, and corner controls apply to both Custom overlays; preset typography and colors remain unchanged. The font dropdown contains the top 20 families from [Google Fonts’ popularity catalog](https://fonts.google.com/?sort=popularity), captured on November 3, 2026: Roboto, Open Sans, Google Sans, Inter, Montserrat, Poppins, Lato, Noto Sans JP, Arimo, Roboto Condensed, Noto Sans, Roboto Mono, Oswald, DM Sans, Raleway, Nunito, Nunito Sans, Playfair Display, Roboto Slab, and Ubuntu. Font files load directly from Google rather than being bundled.

Editing a theme only changes the previews until you apply. Applying updates both OBS graphics without reloading or changing their URLs, and persists across NodeCG restarts. Custom fonts, colors, frame settings, and the shared icon preferences are retained when switching themes. Existing Classic settings carry over to Custom, preserving saved borders, corners, and icons, with Inter as the initial Google Font. Live campaign graphics remain empty until a provider connects. Themes do not change donation data, alert timing, or sound.

Under **Overlay animations**, choose **Thermometer animation** and **Donation alert animation** separately—for example, Draw from left for the thermometer and Soft zoom for alerts. The thermometer enters once when its browser source loads, then stays visible as donations update its total and progress bar. Changing its animation does not replay the entrance on stream; the new choice plays on the next load. It has no timed exit. **Test below** previews that same behavior while the alert completes its enter, hold, and exit cycle. Both choices are saved locally; existing shared animation settings carry over to both overlays.

**BWF** uses the [Bob Woodruff Foundation palette](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/our-brand#colors) and [Source Sans Pro typography](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/style#typography): green `#47763B`, tan `#F0EFDD`, charcoal `#373A36`, and navy `#021F4D`. It is an overlay interpretation of the guide; no foundation logo has been modified or recreated.

## Current UI requirements

These are intentional product decisions, not suggestions to restore older layouts:

- Keep the four tabs in their existing order and preserve the fullbleed native NodeCG layout. The UI app name is **DONATECONTROL**. Keep the internal `gofundme-live` bundle name and `classic` theme key for URL/storage compatibility; the theme's display name is **Custom**.
- The footer has the pig icon and DONATECONTROL on the left, with linked **made by roberthilsky.com** on the right. Do not restore the old top-left brand, powered-by line, or tagline.
- Main's campaign connection cannot collapse. When connected, the overview uses an attached grey surface to its right. While disconnected, that space holds campaign history; choosing a saved entry only prefills the form.
- Section accents are muted solid header backgrounds (red `#984343`, blue `#35588A`) with white heading text and neutral container edges. Do not restore colored left-edge accents. `design.md` supplies broader typography/spacing guidance; these current decisions take precedence over historical styling examples.
- Manual alert control is a compact red block aligned left, joined to a grey explanation on the right. That explanation changes with mode. Keep the donation list heading, search, and filters visually separate from its rows, like a table's window header.
- Every toggle sits immediately to the right of its label, including Manual alert control, Show icon, and Play alert sound. All transient success/error/status feedback uses the shared Sonner toaster at the top center; do not embed action-status messages in page content. Persistent connection state and donation send counts remain in place.
- In Your overlays, the apply instructions and **Apply to overlays** button sit in a narrow grey column to the right of Overlay animations. It sticks while scrolling within the appearance section and stops above **Preview & connect**. At narrow widths it becomes a bottom-sticky control within the same section. Preserve working 320 px layouts and avoid horizontal overflow.
- Testing belongs in Your overlays, except the sound preview beside its sound settings. There is no global header test button or separate Testing section. **Test below** uses unsaved preview appearance; **Test on live overlay** uses applied appearance and saved sound. Demo playground is shown only for a connected Mock / Demo provider.
- Do not restore Main's recent donations card, a live playback queue/dismiss strip, or Alert Settings' old delivery toggle. Donation List & Alerts owns the saved archive and manual/automatic control.
- Previewing themes never requires a connected provider. Real campaign data stays hidden when disconnected, offline, connecting, or in error. Explicit test alerts and labeled samples still work without a provider.
- Keep long donation messages and descenders visible: no fixed line clamp or clipping. `AlertCanvas` measures and scales the complete card into the 1000 × 250 live canvas; very long content becomes smaller rather than being cut off.

## First run: the complete demo

1. Select **Mock / Demo**, leave the URL empty, and click **Connect**.
2. In **Your overlays → Demo playground**, enter `Charity Stream`, raised `12500`, goal `25000`, then **Update campaign**. These are also the demo defaults.
3. In **Your overlays**, open the thermometer preview. It shows **$12,500 raised**, **$25,000 goal**, **50%**.
4. Open the donation alert preview. The live alert graphic is transparent and empty until an alert arrives.
5. Enter donor `Rob`, donation `50`, and click **Send Test Donation** in the playground.
6. The thermometer updates to $12,550 and the alert displays **Rob donated $50.00**, without a page refresh. All mock donations are marked **(TEST)**.

More demo donations queue in order unless manual alert control is on. **Reset demo** restores the defaults, clears the demo provider's current history and playback queue, and establishes a new baseline. The **Donation List & Alerts** archive retains previous demo donations, edits and send counts. Demo totals and the archive persist across server restarts.

In **Your overlays → Preview & connect**, **Test below** plays your current edits in the control-panel previews, without sound or sending anything to stream. **Test on live overlay** uses the applied appearance and saved sound on the live HTML alert page. This button creates unique Alex Morgan / $25 alerts through the same queue but **does not change campaign totals or donation history**. This works without a connected campaign, in either manual or automatic mode.

## Donation List & Alerts

The **Manual alert control** switch takes effect immediately and is saved locally. With it **on**, incoming donations still update campaign totals and enter the list, but wait for the producer to click **Send to screen**. Enabling manual control also holds any pending playback items; an alert already on screen finishes. With it **off**, future donations play automatically. This is the sole alert-delivery control; the former Donation alerts master switch has been removed. Older saved off settings are retired without changing the saved manual/automatic selection. Turning manual control off does **not** release previously held donations. The switch controls delivery regardless of which tab is open.

Every public donation received from a provider is saved in the local NodeCG database, including initial history and donations received in manual mode. Storage retains records across campaigns and restarts, without the old 50-item history limit. The list displays only the connected campaign’s records and hides them when disconnected, connecting, offline, or in error. Search by name, message, campaign or amount, filter by sent/unsent/queued status, and page through 25 records at a time. Provider API privacy rules and history limits still apply; the app cannot recover donations a provider has never supplied.

Click **Edit** to turn a donation row into prefilled **Donor name** and **Donation text** fields. **Save changes** stores the edits; **Cancel** discards the draft, and **Restore original text** fills the fields with the provider's original content. Changed donations show an **Edited** badge and a **Reset** button beside **Edit**. Reset immediately restores the original name/message and clears the badge, preserving send counts and donation data. Edits and resets apply to pending and future alert sends, while a currently displayed alert finishes unchanged. Original donation data, amount, currency, timestamps and test markers remain intact. Provider refreshes never overwrite saved edits.

All dashboard tabs use top-center dismissible toast notifications for action confirmations, errors, copied URLs, credential/sound updates and lost/restored server connections. Notifications float above the page without shifting its content. Persistent connection indicators and donation send counts remain visible in their normal controls. The live playback strip and queue-management controls have been removed.

**Sent N times** includes automatic alerts and producer sends, incrementing once when each alert begins playback. A queued item does not count until it starts, and clearing the playback queue does not change counts or delete donations. **Send again** uses the saved text and never changes campaign totals. Connect the campaign to access its saved history and send controls. **Test on live overlay** in Your overlays still works in manual mode and does not create a donation record.

The upgrade imports locally retained recent donations and demo history. Previous send counts were not recorded and cannot be reconstructed; imported records start at zero. Back up `db/` to preserve the archive, edits, counts and manual-control setting. Playback itself is not persisted or replayed on restart.

## OBS setup

1. Open the NodeCG dashboard and connect a campaign.
2. In **Your overlays**, click **Copy URL** for **Fundraising Thermometer**.
3. In OBS: **Sources → + → Browser**. Paste the URL and set **width 1000, height 180**.
4. Repeat with **Donation Alerts**, using **width 1000, height 250**.
5. Keep **Shutdown source when not visible** and **Refresh browser when scene becomes active** disabled if you want the source to stay synchronized between scenes. One active alert source per composition avoids visually duplicating the same alert.
6. Send a dashboard test alert to verify positioning. Alerts keep the complete donation message and fit their card inside the browser-source canvas; longer messages may scale down to fit. No custom OBS CSS is required; both page backgrounds are transparent.

Default URLs, when opened through localhost:

```text
http://localhost:9090/bundles/gofundme-live/graphics/thermometer.html
http://localhost:9090/bundles/gofundme-live/graphics/alert.html
```

The dashboard constructs URLs using its actual origin, so an alternate host/port is retained. **Open Preview** opens the same URL that **Copy URL** copies. Chromium/OBS should be reasonably current.

For continuous positioning samples, use **Positioning test**, or append `?test=1` to the alert URL (`&test=1` if it already contains an authentication key). This mode displays local **(TEST)** samples, ignores the live alert queue, and never writes campaign state. Remove the test parameter before going live.

The in-dashboard alert preview shows a clearly marked sample when idle; the OBS live graphic remains empty.

## Donation alert sound

In **Alert Settings → Donation sound**, upload an **MP3, WAV, or OGG** file up to **10 MB**. Uploading enables it immediately. Adjust the volume and click **Test alert sound** to listen in your browser before saving; **Stop sound test** stops playback. Use **Save sound settings** to apply the volume and **Play alert sound** switch to your stream. **Remove sound** restores silent alerts.

The live Donation Alerts graphic plays the sound once for each donation, test alert, and resent alert. It stops when the alert closes. The dashboard's embedded visual preview and continuous positioning-test page stay silent. A normal browser may require clicking **Enable sound** once to allow playback.

In OBS, enable **Control audio via OBS** in the Donation Alerts Browser Source properties. Use that source's mixer channel for stream volume and monitoring. Keep only one active audible alert source to avoid duplicate playback.

Uploaded files and settings survive restarting NodeCG. Back up `assets/gofundme-live/alert-sound/` together with `db/` to retain them. Replacing or removing a sound deletes the previous file.

## Campaign connection and switching providers

Click the **Campaign connection** heading to collapse or expand its controls. The header always shows a green light and **Connected to [provider]** when connected, or a red light with disconnected, connecting, error, or server-offline status. Collapsing keeps entered form values intact.

Choose a provider in the **Provider** selector. If another provider still has an active session, a warning appears and **Connect** is disabled. Click **Disconnect [current provider]** in the warning, then connect the selected provider. This is also enforced on the server, including sessions waiting to retry after an error. Selecting a different provider does not disconnect the current session or change its on-air graphics.

## DonorDrive

DonorDrive uses its [public API](https://github.com/DonorDrive/PublicAPI); **no API key is needed**.

1. Disconnect any current provider, then select **DonorDrive**.
2. Paste your charity's public DonorDrive page or site URL, including `https://`. Custom DonorDrive domains are supported.
3. Choose **Participant / Personal campaign**, **Team**, or **Event**.
4. Enter its matching numeric ID. You can leave this blank when the URL contains `participantID`, `teamID`, or `eventID`, or a path such as `/participant/123`. For a custom page alias, supply the numeric ID explicitly.
5. Click **Connect**. Existing donations establish history without triggering alerts.

The provider reads the site's currency, fundraiser totals, and public donations. Hidden names display as **Anonymous**. Hidden amounts and registration fees are excluded from donation history and alerts. Fundraisers must expose public totals through the API; unavailable totals produce an error and hide campaign data until a connection succeeds.

DonorDrive refresh intervals are **15–300 seconds**. ETags avoid unnecessary downloads, and unchanged fundraisers do not trigger donation reads. **Refresh Now** within 15 seconds uses cached data. Initial history paginates through public donations; later updates paginate back to the previous newest timestamp, including ties. Both scans are bounded to 100 pages and fail rather than applying incomplete history. An incomplete update commits no alerts. See [API integration notes](api-integration.md#donordrive-public-api).

## Givebutter

1. Create an API key in Givebutter under **Settings → Developers → API**. See the [official key setup guide](https://help.givebutter.com/en/articles/5489015-how-to-access-the-givebutter-public-api-key) and [API authentication documentation](https://docs.givebutter.com/api-reference/authentication).
2. Disconnect the current provider, select **Givebutter**, and enter the key in **Givebutter API key**. Click **Save API key**.
3. Enter your public `https://givebutter.com/...` campaign URL, or the campaign's ID/code, and click **Connect**. The thermometer uses the campaign's raised total and goal; new public donations enter the existing alert queue.

Keys are stored server-side in `.secrets/givebutter.json` with the same private permissions and direct, same-origin HTTP handling as Pro credentials. Saved values are never returned to the control panel or graphics. Replacing/removing a key disconnects an active Givebutter session. Alternatively, set `GIVEBUTTER_API_KEY` in `.env` and restart; a dashboard-saved key takes precedence. Removing it restores the environment key if present.

Only successful transactions with a public `giving_space.amount` become alerts. Names come exclusively from the public supporter feed; missing names become **Anonymous**. Billing names and private amounts are never used as fallbacks. Initial donations establish history without playing alerts. The API's unique donor count is not presented as a donation count.

Givebutter's published transaction operation lists account transactions, so each poll filters the selected campaign locally and scans at most **10,000 account transactions**. Larger accounts stop with a clear error instead of applying an incomplete update. Requests are spaced below the documented 500/minute limit and honor `Retry-After`. See [integration notes](api-integration.md#givebutter-api).

Automated fixtures and an isolated browser check cover the integration; a real Givebutter account connection still requires your API key and campaign.

## GoFundMe Pro / Classy

**Ordinary consumer GoFundMe campaigns are not supported by this API provider.** A `gofundme.com/f/...` URL or `gofund.me/...` short link does not grant API access. The application rejects these links in Pro mode. It does not scrape campaign pages, use private endpoints, or fetch GoFundMe from the browser.

You need a GoFundMe Pro / Classy organization, an application authorized for that organization, and its **numeric Pro campaign ID**.

1. Obtain application credentials from your organization's admin dashboard, as described in the [official authentication guide](https://developers.gofundme.com/pro/overview/authentication).
2. In **Campaign connection**, select **GoFundMe Pro**. Under **GoFundMe Pro credentials**, enter your **Client ID** and **Client Secret**, then click **Save credentials**. Saved fields clear; a **Configured** status confirms storage. Credentials are validated with GoFundMe when you connect.
3. Enter the numeric campaign ID, optionally enter a Pro campaign URL for reference, and click **Connect**. **No restart is required** after saving in the dashboard.

Dashboard credentials persist in `.secrets/gofundme-pro.json`, outside NodeCG's served bundle and bundle config. The directory is owner-only and the file is created with owner read/write permissions on systems that support Unix permissions. The file is local plaintext configuration, not encrypted storage; it is ignored by Git and must be kept private. Both fields are required when replacing credentials; saved values are never returned to browsers. Replacing or removing credentials disconnects an active Pro session, so click **Connect** afterward to use the new configuration. Mock sessions are unaffected.

**Remove saved credentials** deletes that saved pair and restores environment-variable configuration if present. Dashboard-saved credentials take precedence over the environment as a complete pair.

Alternatively, copy `.env.example` to `.env` in this project's root and set:

   ```dotenv
   GOFUNDME_CLIENT_ID=your-application-client-id
   GOFUNDME_CLIENT_SECRET=your-application-client-secret
   ```

Restart NodeCG after editing `.env`. Existing process environment variables take precedence over `.env`; dashboard-saved credentials take precedence over both.

The form sends entered credentials directly to a private route on the existing NodeCG server, protected by NodeCG's own authentication and a same-origin request check. It does not use NodeCG messages, which broadcast their payloads to other clients. Only non-secret configuration status enters a Replicant. Saved credentials are never read back into the form, broadcast to graphics, included in built browser assets, or logged. Tokens are cached in server memory, renewed before expiry, and retried once on HTTP 401. Do **not** put Pro secrets in a NodeCG bundle config: NodeCG exposes bundle configs to authorized browsers. For remote access, use HTTPS and NodeCG login security.

The integration uses documented client-credentials OAuth and the official campaign/transaction APIs. The totals call follows GoFundMe Pro's own progress-bar sample. See [API sources and normalization](api-integration.md) for exact endpoints, field mapping, privacy rules, and the reference discrepancy around the totals endpoint.

Live Pro access still needs verification with your organization's credentials. Automated tests exercise documented response fixtures, token renewal, pagination, and failures; they do not claim a successful connection to a real organization.

## Polling, alerts, and recovery

- Default refresh interval: **15 seconds**; configurable from **10–300 seconds**, or **15–300 for DonorDrive**. A cycle fetches campaign data and donations, then commits the validated snapshot. Requests never overlap within one polling session.
- HTTP 429 and temporary network/server failures use exponential backoff, up to five minutes, or a longer `Retry-After` delay. **Refresh Now** respects that delay. Authentication, missing-resource, and malformed-response errors stop automatic polling until you reconnect.
- Campaign overview, campaign logs, donation history, and live campaign graphics are visible only after a successful provider connection. They hide while disconnected, connecting, offline, or in error. Saved records remain intact and reappear for the connected campaign. Provider errors stop pending playback; explicit test alerts still work without a provider.
- Every connect/reconnect establishes a baseline and **does not alert for historical or downtime donations**. The application starts disconnected after a restart; saved settings and data remain stored, but campaign data stays hidden until you click **Connect**.
- A persistent, campaign-specific ledger retains up to 20,000 IDs, and a baseline timestamp rejects previously unseen older history. Alerts are deduplicated by transaction ID. The queue and active alert are intentionally not persisted, preventing alert replay on restart.
- Transactions marked anonymous display **Anonymous**. Transactions with a hidden amount are excluded from public history/alerts. Billing details, email addresses, and phone numbers are never copied into public donation state; provider responses may contain fields the application discards. Failed, pending, test, refunded, and non-donation transactions do not produce alerts. Missing public names become **A generous donor**.
- Use manual mode to hold incoming donations. Saving alert duration or refresh interval does not change delivery mode or interrupt playback. Switching back to automatic mode applies only to future arrivals.
- Each entry in **Donation List & Alerts** has **Send to screen** / **Send again** controls. These queue its saved alert text after any alerts already waiting, preserving the amount, currency, and demo/test label. They never change totals or automatic duplicate detection. The campaign must be connected for its saved donation controls to appear.
- Alert display duration is 2–30 seconds **fully visible**, with animation time added before and after. In **Your overlays → Overlay animations**, set **Animation in** (both overlays) and **Alert animation out** independently from 0–10,000 ms; 0 is instant. Defaults are 500 ms in and 400 ms out. For example, 800 ms in + 6 seconds visible + 300 ms out = 7.1 seconds total. Each alert keeps its timing and animation style until it finishes; subsequent alerts use the latest saved settings. **Test below** previews the complete alert cycle without sending an alert or sound to stream, and positioning tests use the saved timings too. The thermometer stays visible and counts increases over 500 ms; all motion has reduced-motion handling. Exceeded goals show their true percentage while the bar stops at 100%. A missing goal displays a neutral message.

GoFundMe Pro polling scans a maximum of **100 pages × 100 transactions** per cycle, with a 250 ms pause between pages. The Pro reference does not promise newest-first ordering for this endpoint, so the application makes no such assumption. Larger Pro campaigns stop with a clear error instead of silently missing donations. Increase the interval for large Pro campaigns; a supported incremental or webhook integration is a future improvement. Webhooks are not required and no public callback server is installed.

## Configuration, local storage, and authentication

Copy `cfg/nodecg.example.json` to `cfg/nodecg.json` for a fresh checkout. The example binds to `127.0.0.1:9090`; open http://localhost:9090/dashboard/. The actual config is local and ignored by Git. Do not overwrite an existing operator's configuration when updating the app.

To use a trusted LAN, explicitly change the local config's `host` to `0.0.0.0` and optionally set `baseURL` to the host computer's reachable hostname/IP and port. Do not hardcode one operator's LAN address into source or the example. Restart NodeCG after changing configuration. No login or internet hosting is configured by the example.

For authenticated or remote use, follow [NodeCG's security documentation](https://www.nodecg.dev/docs/security/) and configure NodeCG's own login settings. When login is enabled, the URL buttons use NodeCG's existing socket token in its official `?key=...` format. If no token is available, use NodeCG's **Graphics** tab to copy the authenticated URL. These keys grant full NodeCG access and must stay private. They are separate from provider credentials.

`db/`, `logs/`, `assets/`, `.env`, `.secrets/`, the real `cfg/*.json` files, and generated dashboard/graphic/extension output are ignored by Git. Only the blank environment template and localhost config example are published. Do not commit provider responses, donor archives, uploaded sounds, credentials, runtime snapshots, or local test artifacts. Back up `db/` and uploaded sound assets to preserve settings/history; keep any credential backup private.

## Development and checks

```bash
npm run typecheck
npm test
npm run build
```

Vitest covers currency/percentage logic, baseline and deduplication, alert ordering/exit timing, retry behavior, provider parsing/privacy, OAuth/pagination, DonorDrive ETags and catch-up, settings compatibility, Givebutter authentication/pagination/privacy, sound file validation/storage, and disconnect-before-switch enforcement. The provider integration suite also exercises documented HTTP responses through the actual adapters, campaign service, archive and alert queue. See [Provider verification](provider-verification.md) for the November 3, 2026 API review, browser checks, fixes and remaining limits. No browser-test framework is included.

```text
src/
  extension/
    index.ts                 NodeCG Replicants and message handlers
    providers/               Provider interface, Mock, GoFundMe Pro, DonorDrive, Givebutter
    services/                Campaign orchestration, polling, dedupe, alert queue
  shared/                    Typed models, runtime schemas, defaults, formatting
  client/
    dashboard/               React control panel
    graphics/                OBS entry pages and isolated URL test mode
    shared/                  Replicant hooks, graphic components, motion
bundles/gofundme-live/
  package.json               NodeCG bundle manifest
  schemas/                   Generated JSON schemas (checked in)
  dashboard/, graphics/      Built by Vite
  extension/                 Built by esbuild
scripts/                     Build and development runner
tests/                       Lightweight Vitest tests
```

Schema definitions in `src/shared/models.ts` generate the JSON schemas during each build. Commands validate inputs on the server, and external responses are validated before normalization. To add a future consumer-campaign integration, implement `FundraisingProvider`, select it in the campaign service, and extend the provider enum/UI; the graphics continue reading the same generic Replicants.

If the port is occupied, stop the existing instance or change `cfg/nodecg.json` and restart. If a source appears blank, check that NodeCG is running, the campaign is connected, manual control is set as intended, and you copied the correct URL. A donation-alert source being blank while idle is expected. The event log retains the latest 50 events. The persistent `donationHistory` Replicant retains all donations received by the app; the old `recentDonations` Replicant remains only for compatibility and migration.

## Agent workflow and verification

- Keep the operator's current server, provider connection, donation archive, appearance, and sound settings intact. Source edits under `npm run dev` rebuild and restart NodeCG, which starts disconnected; reconnect the previous campaign after a needed restart and verify its settings/history were preserved.
- Run tests that inject donations, change settings, upload sounds, or exercise mock credentials in an isolated project copy with its own NodeCG root, port, `db/`, `cfg/`, `assets/`, and `.secrets/`. Never send test alerts to an operator's live stream unless that action is requested. Stop temporary servers when finished.
- Use `npm run typecheck`, `npm test`, and `npm run build` for relevant code changes. For UI changes, also inspect desktop/mobile layouts and native NodeCG iframe scrolling. No Playwright dependency is included in this repository; browser checks require a separately available browser/tooling environment.
- Existing provider contract tests use fixtures. Do not describe them as authenticated production verification. See `provider-verification.md` for what was actually tested and the remaining integration limits; dated test counts there describe that audit, not a fixed current suite size.
- Build output and Replicant schemas come from source. Keep the bundle manifest available for the build; edit `src/shared/dashboard.ts` for dashboard page names/order and `src/shared/models.ts` for runtime schemas/defaults. Persisted schema changes need defaults/migrations so existing local settings continue to load.
- `src/shared/appearance.ts` resolves legacy/shared animation fields into separate alert/thermometer choices and merges optional Custom fields with defaults. Preserve that compatibility when changing appearance settings.
- `src/shared/fonts.ts` contains the allowlisted Google Fonts. `src/client/shared/useGoogleFont.ts` loads only selected Custom font CSS over the internet and handles sharing/cleanup. Do not bundle new Custom font files; bundled dashboard/preset fonts and their licenses are separate.
- Do not infer a successful OBS render from a send count: counts record server playback starts, even if no OBS browser source is open. Preserve this distinction in UI copy and documentation.
- Keep this document and relevant integration/theme notes aligned with changes. Keep README limited to app name, author, installation, and a short feature list.
