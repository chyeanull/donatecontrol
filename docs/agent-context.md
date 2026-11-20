# DONATECONTROL — agent context

Maintainer: [Robert Hilsky](https://roberthilsky.com). Read this before changing product behavior. This document preserves the detailed setup, feature behavior, architecture, and integration limits formerly in the README. Keep it current as the app changes; the README stays a short installation and features overview.

A local NodeCG broadcast studio with a React control panel, transparent fundraising thermometer, and queued donation alerts for OBS. Supports GoFundMe Pro / Classy, DonorDrive, Givebutter, Movember, and Mock / Demo. The bundle is named `gofundme-live`. Mock mode works without an account or credentials.

## Install and run

Use **Node.js 22.12 or newer** (Node 22 LTS recommended) and npm.

```bash
npm install
cp cfg/nodecg.example.json cfg/nodecg.json
npm run dev
```

Open **http://localhost:9090/dashboard/**. The root http://localhost:9090 redirects to the dashboard. Use the **Campaign**, **Your overlays**, **Alert Settings**, and **Donation List & Alerts** tabs at the top of NodeCG. **Campaign** is the default workspace.

`dev` builds the React pages, extension, and Replicant schemas, starts NodeCG, and rebuilds/restarts on changes under `src/`. Refresh browser pages after a rebuild and reconnect the campaign. Configuration, build scripts, and `.env` changes require restarting `dev`. This intentionally serves everything through NodeCG; there is no separate Vite web server.

For a broadcast, use the built application without file watching:

```bash
npm run build
npx nodecg start
```

`npm start` is equivalent to `npx nodecg start`. Leave it running throughout the stream. Stop with Ctrl+C.

NodeCG **2.8.0** is pinned as a dependency; `bundles/gofundme-live/` contains the bundle. This follows NodeCG's [documented dependency installation](https://www.nodecg.dev/docs/installing-new/), which NodeCG still labels experimental. The dependency setup and CLI are verified with this pinned version. No global CLI or separate NodeCG checkout is needed.

## Control panel tabs and themes

The control panel follows the attached [ESportsArena design system](design.md): compact black surfaces, red and blue accents, bold Raleway headings, Inter body text, and JetBrains Mono for statistics, URLs, and timestamps. Dashboard headings and the wordmark load Raleway from Google Fonts. Dashboard body/monospace fonts and the existing Quest/BWF fonts are bundled locally. Custom loads its selected font from Google Fonts; Cyberkid loads Rajdhani, Grandsteal loads Oswald, Counter-Strike 2 loads Roboto Condensed, and MustacheRider loads Rubik Spray Paint from Google Fonts without bundling new fonts. Internet fonts use a sans-serif fallback while loading or offline.

- **Campaign:** always-open provider connection and credentials on the left, an attached grey campaign overview on the right when connected, saved connection history on the right when disconnected, and an event log. Successful connections to real providers are saved locally, newest first. Mock / Demo connections are excluded, including any demo entries saved by older versions. While disconnected, choose a history entry to prefill its provider and campaign fields, then click **Connect**. The history disappears while connecting and is replaced by the campaign overview on success; failed connections bring the history back.
- **Your overlays:** thermometer and alert previews, OBS URLs and dimensions, themes and animations, on-stream test alerts and connected Mock / Demo tools.
- **Alert Settings:** alert timing, polling interval, sound upload/volume settings, and a local sound test.
- **Donation List & Alerts:** compact manual alert control with its current mode and explanation alongside it, locally saved donations for the connected campaign, editable donor names and messages, send/replay controls, and send counts.

These are four native, full-page NodeCG workspaces ordered left to right: **01 · Campaign → 02 · Your overlays → 03 · Alert Settings → 04 · Donation List & Alerts**. The build generates their labels and order from the same definition used by standalone navigation. Standalone panel URLs also provide navigation between pages. Existing `control.html` bookmarks continue to open Campaign. Restart NodeCG once after upgrading so it discovers the new tabs, then refresh the dashboard.

In **Your overlays**, select **Custom**, **Quest**, **BWF**, **Cyberkid**, **Grandsteal**, **Counter-Strike 2**, or **MustacheRider** to preview both graphics, then click **Save Changes**. Previews and animation tests work before connecting a provider, using clearly labeled sample data. **Custom** (previously Classic) includes a Google Font dropdown, plus font, accent, and background colors with color pickers and six-digit hex inputs; border size from 0–10 whole pixels; rounded or straight corners. **Show icon** and a compact custom icon dropdown, showing each symbol beside its name in both the control and its options, are available for every theme and share one setting across all seven themes. MustacheRider has its own hot dog artwork and receipt logo, so its icon controls are hidden while other themes retain the shared icon setting. Choose from Heart, Happy face, Gift, Praying hands, Giving hand, Handshake, Star, Ribbon, Coin, and Sprout. A zero border is borderless; hiding the icon removes its space from the alert layout. Font, color, border, and corner controls apply to both Custom overlays; preset typography and colors remain unchanged. The font dropdown contains the top 20 families from [Google Fonts’ popularity catalog](https://fonts.google.com/?sort=popularity), captured on November 3, 2026: Roboto, Open Sans, Google Sans, Inter, Montserrat, Poppins, Lato, Noto Sans JP, Arimo, Roboto Condensed, Noto Sans, Roboto Mono, Oswald, DM Sans, Raleway, Nunito, Nunito Sans, Playfair Display, Roboto Slab, and Ubuntu. Font files load directly from Google rather than being bundled.

Editing a theme only changes the previews until you apply. Applying updates both OBS graphics without reloading or changing their URLs, and persists across NodeCG restarts. Custom fonts, colors, frame settings, and the shared icon preferences are retained when switching themes. Existing Classic settings carry over to Custom, preserving saved borders, corners, and icons, with Inter as the initial Google Font. Live campaign graphics remain empty until a provider connects. Themes do not change donation data. MustacheRider has fixed custom playback timing and built-in receipt sounds; other themes use the saved timing controls and uploaded alert sound.

Under **Overlay animations**, choose **Thermometer animation** and **Donation alert animation** separately: Draw from left, Rise & fade, Soft zoom, Slide from right, or Center reveal. Slide from right moves the frame in from the right edge; Center reveal opens outward like a curtain without moving the text. Alert exits reverse those paths. The thermometer enters once when its browser source loads, then stays visible as donations update its total and progress bar. Changing its animation does not replay the entrance on stream; the new choice plays on the next load. It has no timed exit. **Test below** previews that same behavior while the alert completes its enter, hold, and exit cycle. Both choices are saved locally; existing shared animation settings carry over to both overlays. MustacheRider disables the standard animation and speed controls, preserving their values for other themes, and uses the fixed sequences below.

**BWF** uses the [Bob Woodruff Foundation palette](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/our-brand#colors) and [Source Sans Pro typography](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/style#typography): green `#47763B`, tan `#F0EFDD`, charcoal `#373A36`, and navy `#021F4D`. It is an overlay interpretation of the guide; no foundation logo has been modified or recreated.

**Cyberkid** (`cyberpunk`) uses bright yellow, ink-black text, cyan details, cut-corner backing, and Rajdhani headings. **Grandsteal** (`gta6`) uses deep violet, warm cream, sunset pink/peach accents, and Oswald headings. These are original style interpretations of the [Cyberpunk site](https://www.cyberpunk.net/us/en/) and [GTA VI site](https://www.rockstargames.com/VI), not imported game art or logos. Both themes cover the picker sample, thermometer, and donation alert; support the global icon controls, all animations, long messages, and disconnected previews. Only backgrounds are cut or decorated; preserve the outer animation clipping and full message bounds. Keep the existing `cyberpunk` and `gta6` storage keys so renamed themes retain saved selections.

**Counter-Strike 2** (`cs2`) uses charcoal panels, orange accents, condensed headings, and a locally bundled chicken render in the theme sample, thermometer, and alert. The chicken is part of this theme, independent of the global donation icon toggle and selection. Keep it visible when icons are off, reserve space for it so donation text never overlaps it, and retain normal alert fitting and the persistent thermometer. The source and artwork attribution are recorded in [the image attribution file](../src/client/shared/images/ATTRIBUTION.md).

**MustacheRider** (`mustacherider`) uses the owner-supplied hot dog SVG artwork, moved unchanged from `mustach/` to `src/client/shared/images/mustacherider/`. PNG references are preserved in `docs/theme-references/mustacherider/`. Render the bun beneath the mustard and reveal the mustard with a horizontal mask based on its visible path bounds and the exact `raised / goal` ratio. Use a rounded leading edge for both the initial reveal and live funding updates. Pad the mask on the left to preserve the start of the artwork, and clear its original end at 100%. Do not scale the mustard or use the full canvas width as its progress range. Six brown Rubik Spray Paint cash labels run from zero to the effective goal in fifths, with compact currency notation. Keep the labels at 28px in the SVG viewBox with an en-space on each side of the vertical dividers. Provider goals and Movember custom goals/reset update both the labels and fill; zero/missing goals show no mustard, and overfunded goals show full mustard. The thermometer remains visible as funding changes. Recommend 1000 × 360 for this thermometer, preserving the illustration’s aspect ratio; the receipt alert uses a 1920 × 1080 canvas. Rubik Spray Paint loads from Google at weight 400 and does not expand Custom’s font dropdown. See [overlay-themes.md](overlay-themes.md) for rendering details.

MustacheRider's hot dog rises from below with a small jiggle over 900 ms, then the mustard reveals from left to right over 1800 ms. It stays on screen; funding/goal updates ease the rounded mustard mask from its current position to the new total over 2400ms, without replaying the entrance. A further update during this transition continues from the current visible fill. Reduced motion applies updates instantly. The theme sample and idle dashboard preview are static; **Test below** replays the complete custom sequence.

Its donation alert is an off-white printed receipt with the owner-supplied Mustachio logo, bundled Fira Code register-style typography, donor name, amount, full message, a test marker when applicable, torn edges, and a decorative barcode. The logo is bundled from `src/client/shared/images/mustacherider/Mustachio_SVG.svg`, moved unchanged from the project root. Global donation icon settings do not affect this artwork. The receipt stays anchored 48px from the right/bottom of a transparent **1920 × 1080** canvas. Its paper is a fixed 640px wide with natural height capped at 984px, leaving 48px at the top and bottom. Long messages grow the receipt up to that cap without shrinking the paper or type. Overflowing message text pauses for one second after the receipt settles, scrolls slowly, then pauses on the final lines for one second. The name, amount, and footer stay in place. Short receipts hold for 10 seconds; long messages automatically get extra reading time based on their text length and line breaks, shared by the server queue and graphic. Reduced motion uses instant page changes instead of smooth scrolling. Idle previews allow manual scrolling of the message. Only the whole 1920 × 1080 stage scales to fit dashboard previews. Keep the top compact: a centered 112px Mustachio logo, then bold donor name and amount side by side, without DONATION RECEIPT or RECEIVED FROM headings. The message uses 30px text; a small test marker lives by the footer. Tear notches stay 6px deep regardless of paper height. It stays hidden for a 1.5-second cha-ching lead-in, then prints sideways from the right edge in twelve steps over 2400 ms, tears free over 300 ms, rotates upright over 900 ms, holds for **at least 10 seconds** (long messages extend this), then floats below the canvas over 1400 ms: **16.5 seconds minimum total**. Standard animation selectors, speed fields, and Alert Settings' duration are disabled for this theme; saved values for other themes are preserved. Reduced motion uses fades with the same queue schedule.

`resolveAlertPlayback` captures the theme, entrance, hold, and exit for each alert at playback start. Theme/timing changes apply to the next alert, including when changing to/from MustacheRider. The server queue, live graphics, dashboard test, and direct positioning test share the timing constants in `src/shared/mustacheRider.ts`. `mustacheRiderHoldMs` estimates reading lines conservatively at 25 text cells, including newlines, tabs and wide characters. Above 10 estimated lines, reserve 1.6 seconds per line plus the two pauses (at least 20 seconds). Playback captures that hold when the donation starts, including queued edits; the graphic scrolls across the captured hold minus the pauses. The playback schema permits these longer holds; the standard duration control remains 2–30 seconds for other themes. Older playback objects without theme/hold fields remain supported. Do not shorten the receipt reading time by counting its printing animation as visible time, and do not start the next alert until the exit finishes.

MustacheRider adds **Send with fade** directly below each donation’s ordinary send button. It starts only when the alert overlay is idle, fades the upright receipt in over 300 ms, plays no audio (including cha-ching), skips the printing motion, and holds until the producer clicks **Fade out**. Fade-out takes 300 ms; the send lock stays active through that exit. Font loading and paper-size changes must not restart a held fade or its exit. Long messages keep their one-second pause and reading-speed scroll, then remain on their final lines until dismissed. Count the donation once when fade playback starts, never again on fade-out. While held, disable all other send buttons (including live tests and demo sends), reject competing sends on the server, and prevent applying another theme. Validate fade-out against both the archive entry and unique playback ID. Keep the active row reachable even when search, the Not sent filter, or pagination would otherwise hide it. Automatically arriving donations still update the archive and campaign totals and queue behind the held receipt; they resume only after fade-out completes. Manual mode still holds new arrivals and clears pending playback when enabled. Disconnection clears the active receipt and lock. These controls are based on the applied theme, not an unsaved preview selection.

The top right of **Donation List & Alerts** also has a MustacheRider-only **Hide thermometer / Show thermometer** button. Hide slides the hot dog down over 900 ms at full opacity, without fading; Show replays its existing 900 ms rise/jiggle and 1800 ms mustard reveal. Interruptions continue from the current pose and opacity, funding updates only ease the mustard, and reduced motion uses a 200 ms fade. `mustacheRiderControls.thermometerVisible` defaults to true and persists locally across reloads/restarts. It affects only the live MustacheRider thermometer; dashboard previews and all other themes ignore it. Feedback for both controls uses toasts.

## Current UI requirements

These are intentional product decisions, not suggestions to restore older layouts:

- Keep the four tabs in their existing order and preserve the fullbleed native NodeCG layout. The UI app name is **DONATECONTROL**. Keep the internal `gofundme-live` bundle name and `classic` theme key for URL/storage compatibility; the theme's display name is **Custom**.
- Do not show large page-title text above the content. A full-width pure-black (`#000000`) connection bar sits at the top of the page in normal document flow and scrolls away with the content. It is exactly 30 px tall and outside the content width limit; do not make it sticky or fixed. Provider status is flush with the top-right edge; the connected campaign title sits immediately to its left and truncates on narrow screens. Hide the campaign title unless the provider is connected. Standalone navigation follows the [Modern UI Segment pattern](https://modernui.replit.app/#/pattern/motion-tabs): one rounded grey track, equal-width segments, and an inset selected surface. Labels have no numbers and use Raleway at 24 px (20 px on narrow screens), in their normal letter case. The four segments become a two-column grid on narrow screens. Real page links preserve deep links and browser history; arrow keys, Home, and End move focus. A short native view transition moves the selected surface in supporting browsers; keyboard navigation and reduced-motion preferences switch instantly.
- The footer has the pig icon and DONATECONTROL on the left, with linked **made by roberthilsky.com** on the right. Do not restore the old top-left brand, powered-by line, or tagline.
- On Campaign, the connection section cannot collapse. When connected, the overview uses an attached grey surface to its right, with 80px inner padding and a subtle top-right "connected campaign details" tag. While disconnected, that space holds campaign history; choosing a saved entry only prefills the form.
- Section accents are muted solid header backgrounds (red `#984343`, blue `#35588A`) with white heading text and neutral container edges. Connection history and Event log use neutral grey headers (`#404040`). Do not restore colored left-edge accents. `design.md` supplies broader typography/spacing guidance; these current decisions take precedence over historical styling examples.
- Manual alert control is a compact block joined to a grey explanation on the right. The toggle block is red when manual control is off and green when on; highlight only the word OFF/ON in the adjacent status label with the same state color and white text. Both blocks have 16px inner padding; the overall section fits its content width and stays left-aligned rather than spanning the page. On wide screens, the red block stretches to match the grey block's height, with its label and toggle vertically centered. The blocks stack on narrow screens. The explanation changes with mode. Keep the donation list heading, search, and filters visually separate from its rows, like a table's window header.
- Donation rows are compact, with 10 px vertical padding and visible horizontal dividers. Hide the campaign name in each row. Show the donation date above its time in a left column beside the donor name/message, with a donation number to the left of that timestamp. Put the number in a vertically centered grey label with equal spacing between the row's left edge and the label, and between the label and timestamp. Number each campaign's saved donations from 1 in archive arrival order before filtering, pagination, or newest-first display; these labels appear only in the dashboard and never in overlays. Keep TEST and Edited badges beside the name. Group the amount with only **Sent X time(s)** (no last-sent date), and use a narrow Send/Edit/Reset button cluster. On narrow screens, retain the number and timestamp beside the text and move the actions into one wrapping row below.
- The donation toolbar has two pill filter buttons under a **Filter** label: **Show all** and **Not sent**, with the selected button filled red. The search field stays left-aligned at half its available desktop width; it fills the row on narrow screens. Not sent includes entries with a zero send count. Disable it when none remain and return an active Not sent view to Show all; re-enable it when a new unsent donation arrives. Both filters work with search and reset pagination to the first page; do not restore the dropdown or Sent/Queued filter options.
- Custom typography and frame controls use one compact row: a flexible Google Font field followed by narrow Border (px) and Corners fields. Wrap the font above the other fields on very narrow screens. There are no Colors, Typography, or Border & corners group headings or the removed explanatory paragraphs. Individual color fields retain their labels. The custom icon dropdown shows all 10 symbols with names, a selected checkmark, keyboard navigation/typeahead, and touch support; it opens above or below as space allows.
- Every toggle sits immediately to the right of its label, including Manual alert control, Show icon, and Play alert sound. Toggles use a 72 × 34 px pill track with a circular thumb and an internal OFF label on the right or ON label on the left. Preserve each toggle's existing colors, including blue for sound and the white/state-color manual-control variant. All transient success/error/status feedback uses the shared Sonner toaster at the top center; do not embed action-status messages in page content. Persistent connection state and donation send counts remain in place.
- In Your overlays, the preview instructions and **Save Changes** button sit in a narrow grey column to the right of Overlay animations. The button and its container’s 4 px border are red when saving is enabled and grey when disabled. It sticks while scrolling within the appearance section and stops above **Preview & connect**. At narrow widths it becomes a bottom-sticky control within the same section. Preserve working 320 px layouts and avoid horizontal overflow.
- Timing explanations live in small info tooltips beside Alert duration, Refresh interval, Animation in, and Alert animation out. Support mouse hover, keyboard focus/Escape, and tap/outside dismissal; keep tooltips inside the viewport. Do not restore the removed timing/delivery paragraphs, Preview & connect description/footer, or Positioning test link. The direct `?test=1` graphic URL still works.
- Testing belongs in Your overlays, except the sound preview beside its sound settings. There is no global header test button or separate Testing section. **Test below** uses unsaved preview appearance; **Test on live overlay** uses applied appearance and saved sound. Demo playground is shown only for a connected Mock / Demo provider.
- Do not restore Campaign's recent donations card, a live playback queue/dismiss strip, or Alert Settings' old delivery toggle. Donation List & Alerts owns the saved archive and manual/automatic control.
- Previewing themes never requires a connected provider. Real campaign data stays hidden when disconnected, offline, connecting, or in error. Explicit test alerts and labeled samples still work without a provider.
- Keep long donation messages and descenders visible: no fixed line clamp or clipping. `AlertCanvas` measures and scales the complete card into the 1000 × 250 live canvas; very long content becomes smaller rather than being cut off.

## First run: the complete demo

1. Select **Mock / Demo**, leave the URL empty, and click **Connect**. The donation list starts with 10 sample donations with varied names, amounts, and messages, all marked as demo data. These are historical samples: they start unsent, do not auto-play on connection, and do not add to the existing demo total. They support the normal edit, reset, and send controls.
2. In **Your overlays → Demo playground**, enter `Charity Stream`, raised `12500`, goal `25000`, then **Update campaign**. These are also the demo defaults.
3. In **Your overlays**, open the thermometer preview. It shows **$12,500 raised**, **$25,000 goal**, **50%**.
4. Open the donation alert preview. The live alert graphic is transparent and empty until an alert arrives.
5. Enter donor `Rob`, donation `50`, and click **Send Test Donation** in the playground.
6. The thermometer updates to $12,550 and the alert displays **Rob donated $50.00**, without a page refresh. All mock donations are marked **(TEST)**.

More demo donations queue in order unless manual alert control is on. **Reset demo** restores the defaults and the 10 sample donations, clears the playback queue, and establishes a new baseline. Stable sample IDs avoid duplicate archive rows on reconnect, restart, or reset. Existing demo donations remain saved; the **Donation List & Alerts** archive retains their edits and send counts. Demo totals and the archive persist across server restarts.

In **Your overlays → Preview & connect**, **Test below** plays your current edits in the control-panel previews, without sound or sending anything to stream. **Test on live overlay** uses the applied appearance and saved sound on the live HTML alert page. This button creates unique Alex Morgan / $25 alerts through the same queue but **does not change campaign totals or donation history**. This works without a connected campaign, in either manual or automatic mode.

## Donation List & Alerts

The **Manual alert control** switch takes effect immediately and is saved locally. With it **on**, incoming donations still update campaign totals and enter the list, but wait for the producer to click **Send to screen**. Enabling manual control also holds any pending playback items; an alert already on screen finishes. With it **off**, future donations play automatically. This is the sole alert-delivery control; the former Donation alerts master switch has been removed. Older saved off settings are retired without changing the saved manual/automatic selection. Turning manual control off does **not** release previously held donations. The switch controls delivery regardless of which tab is open.

Every public donation received from a provider is saved in the local NodeCG database, including initial history and donations received in manual mode. Storage retains records across campaigns and restarts, without the old 50-item history limit. The list displays only the connected campaign’s records and hides them when disconnected, connecting, offline, or in error. Search by name, message, campaign or amount, choose Show all or Not sent, and page through 25 records at a time. Provider API privacy rules and history limits still apply; the app cannot recover donations a provider has never supplied.

Click **Edit** to turn a donation row into prefilled **Donor name** and **Donation text** fields. **Save changes** stores the edits; **Cancel** discards the draft, and **Restore original text** fills the fields with the provider's original content. Changed donations show an **Edited** badge and a **Reset** button beside **Edit**. Reset immediately restores the original name/message and clears the badge, preserving send counts and donation data. Edits and resets apply to pending and future alert sends, while a currently displayed alert finishes unchanged. Original donation data, amount, currency, timestamps and test markers remain intact. Provider refreshes never overwrite saved edits.

All dashboard tabs use top-center dismissible toast notifications for action confirmations, errors, copied URLs, credential/sound updates and lost/restored server connections. Notifications float above the page without shifting its content. Persistent connection indicators and donation send counts remain visible in their normal controls. The live playback strip and queue-management controls have been removed.

**Sent N times** includes automatic alerts and producer sends, incrementing once when each alert begins playback. A queued item does not count until it starts, and clearing the playback queue does not change counts or delete donations. **Send again** uses the saved text and never changes campaign totals. Connect the campaign to access its saved history and send controls. **Test on live overlay** in Your overlays still works in manual mode and does not create a donation record.

The upgrade imports locally retained recent donations and demo history. Previous send counts were not recorded and cannot be reconstructed; imported records start at zero. Back up `db/` to preserve the archive, edits, counts and manual-control setting. Playback itself is not persisted or replayed on restart.

## OBS setup

1. Open the NodeCG dashboard and connect a campaign.
2. In **Your overlays**, click **Copy URL** for **Fundraising Thermometer**.
3. In OBS: **Sources → + → Browser**. Paste the URL and set **width 1000, height 180** (**height 360** for MustacheRider).
4. Repeat with **Donation Alerts**, using **width 1000, height 250** (**1920 × 1080** for MustacheRider).
5. Keep **Shutdown source when not visible** and **Refresh browser when scene becomes active** disabled if you want the source to stay synchronized between scenes. One active alert source per composition avoids visually duplicating the same alert.
6. Send a dashboard test alert to verify positioning. Alerts keep the complete donation message and fit their card inside the browser-source canvas; longer messages may scale down to fit. No custom OBS CSS is required; both page backgrounds are transparent.

Default URLs, when opened through localhost:

```text
http://localhost:9090/bundles/gofundme-live/graphics/thermometer.html
http://localhost:9090/bundles/gofundme-live/graphics/alert.html
```

The dashboard constructs URLs using its actual origin, so an alternate host/port is retained. **Open Preview** opens the same URL that **Copy URL** copies. Chromium/OBS should be reasonably current.

For continuous positioning samples, append `?test=1` to the alert URL (`&test=1` if it already contains an authentication key). This mode displays local **(TEST)** samples, ignores the live alert queue, and never writes campaign state. Remove the test parameter before going live.

The in-dashboard alert preview shows a clearly marked sample when idle; the OBS live graphic remains empty.

## Donation alert sound

For themes other than MustacheRider, in **Alert Settings → Donation sound**, upload an **MP3, WAV, or OGG** file up to **10 MB**. Uploading enables it immediately. Adjust the volume and click **Test alert sound** to listen in your browser before saving; **Stop sound test** stops playback. Use **Save sound settings** to apply the volume and **Play alert sound** switch to your stream. **Remove sound** restores silent alerts.

MustacheRider uses the three owner-supplied MP3s moved unchanged from `Mustach/` to `src/client/shared/audio/mustacherider/`. Cha-ching starts when the receipt triggers. After a 1.5-second lead-in, the chime stops and the printer sound and receipt feeding start together at 1500ms. Printing stops and the paper rip starts at tear-off (3900ms), before rotation. The rip tail can continue during rotation. The lead-in is included in server queue timing and all animation previews, including reduced motion and muted playback; total alert time starts at 16.5 seconds and extends for long messages. Global upload/replacement and removal are unavailable while MustacheRider is applied, and the saved file and its enabled state are preserved for other themes. The built-in sounds play automatically without an uploaded file, use the shared Volume setting, and are muted by setting it to zero. **Test alert sound** plays the same three cues locally. Captured playback themes select the sounds, so changing themes during a receipt does not replace its sound sequence. Dismissal, disconnection, unmount, or a new alert stops all old sounds and scheduled cues. Autoplay unlock joins the current cue instead of replaying sounds out of sync.

The live Donation Alerts graphic plays the sound once for each donation, test alert, and resent alert. It stops when the alert closes. The dashboard's embedded visual preview and continuous positioning-test page stay silent. A normal browser may require clicking **Enable sound** once to allow playback.

Sound settings arrive asynchronously when an overlay mounts. Do not mark an alert's sound as handled until an enabled file is available; retry when those settings arrive while the alert is still visible. This matters especially for provider-disconnected tests and opening the graphic during an active alert. Volume updates must not restart playback, and late playback promises must not affect a newer alert.

In OBS, enable **Control audio via OBS** in the Donation Alerts Browser Source properties. Use that source's mixer channel for stream volume and monitoring. Keep only one active audible alert source to avoid duplicate playback.

Uploaded files and settings survive restarting NodeCG. Back up `assets/gofundme-live/alert-sound/` together with `db/` to retain them. Replacing or removing a sound deletes the previous file.

## Campaign connection and switching providers

The **Campaign connection** controls are always expanded. The header shows a green light and **Connected to [provider]** when connected, or a red light with disconnected, connecting, error, or server-offline status.

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

## Movember

Select **Movember** on Campaign and paste a public personal Mo Space URL (`https://us.movember.com/mospace/14056397`) or the supplied member donation-feed URL (`https://api.movember.com/v18/newsfeed/?entity_type=0&entity_id=14056397&filter_type=donation`). Alternatively, enter the numeric **Member ID**. Custom `/m/` aliases need the numeric member ID as well. No credentials are required. This integration supports personal/member Mo Spaces (`entity_type=0`); team and network pages are not supported yet.

The public member endpoint supplies the fundraiser name, original currency, raised total, and target. Use the original amount/currency, never the converted AUD amount. The thermometer uses the provider total, which may include donations excluded from the public feed. Movember does not report a reliable total donation count here, so the campaign's Donations statistic stays unset.

On a connected **Movember** campaign only, a compact **Edit** button beside the Fundraising goal label opens a prefilled amount field with Save and Cancel. Saving a positive custom goal updates the campaign overview, percentages, previews, and live thermometer immediately. A compact **Reset** button appears beside Edit while an override is active and restores the latest goal from a complete successful API refresh. Active overrides add an asterisk to the Fundraising goal label and show “*custom goal amount” in small text directly below the amount; both disappear after reset. Feedback uses toasts. This is a local display override; it never writes to Movember or changes raised totals or donations.

Custom goals are persisted in `movemberGoalOverrides`, scoped to member ID, fundraising year, and currency. They survive polling, reconnects, and server restarts without affecting other campaigns or providers. The shared `campaign.goal` and `campaign.percent` always contain effective display values; optional `campaign.goalOverridden` drives the control state. Keep the unmodified provider snapshot in the service for reset, and apply the latest saved override only after a complete successful poll. Reject goal commands for a disconnected/non-Movember campaign or a stale campaign ID/currency.

Import only public donations from the current fundraising year. Keep anonymous donors anonymous, exclude hidden posts/amounts, and omit messages when `show_message` is false. Initial history is saved without playing alerts. Later arrivals use the existing automatic/manual delivery, edits, resets, send counts, sounds, and overlay settings. Archives and connection keys include the member ID and fundraising year; reconnecting via either the URL or numeric ID does not duplicate records.

Polling is **15–300 seconds**, with complete successful snapshots cached for 15 seconds to limit manual refresh requests. Configuration dates are cached for up to an hour and refreshed at the year boundary. Requests are spaced at least 250 ms apart, honor `Retry-After`, and time out after 12 seconds. Initial history scans all pages in the current year; later scans catch up through the last seen timestamp. Pagination overlaps its last second and can expand from 30 to the observed 90-record cap. If a full 90-record second cannot be paged completely, or the 100-page guard is reached, fail visibly without committing partial totals or alerts.

These are publicly readable Movember v18 endpoints verified against the official Mo Space site, not a published third-party API contract. See [API integration notes](api-integration.md#movember-public-member-feed) and [provider verification](provider-verification.md#movember-addition--november-16-2026) for evidence, privacy rules, and limits. Do not describe fixture-generated arrivals as real donations received during verification.

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

- Default refresh interval: **15 seconds**; configurable from **10–300 seconds**, or **15–300 for DonorDrive and Movember**. A cycle fetches campaign data and donations, then commits the validated snapshot. Requests never overlap within one polling session.
- HTTP 429 and temporary network/server failures use exponential backoff, up to five minutes, or a longer `Retry-After` delay. **Refresh Now** respects that delay. Authentication, missing-resource, and malformed-response errors stop automatic polling until you reconnect.
- Campaign overview, campaign logs, donation history, and live campaign graphics are visible only after a successful provider connection. They hide while disconnected, connecting, offline, or in error. Saved records remain intact and reappear for the connected campaign. Provider errors stop pending playback; explicit test alerts still work without a provider.
- Every connect/reconnect establishes a baseline and **does not alert for historical or downtime donations**. The application starts disconnected after a restart; saved settings and data remain stored, but campaign data stays hidden until you click **Connect**.
- A persistent, campaign-specific ledger retains up to 20,000 IDs, and a baseline timestamp rejects previously unseen older history. Alerts are deduplicated by transaction ID. The queue and active alert are intentionally not persisted, preventing alert replay on restart.
- Transactions marked anonymous display **Anonymous**. Transactions with a hidden amount are excluded from public history/alerts. Billing details, email addresses, and phone numbers are never copied into public donation state; provider responses may contain fields the application discards. Failed, pending, test, refunded, and non-donation transactions do not produce alerts. Missing public names become **A generous donor**.
- Use manual mode to hold incoming donations. Saving alert duration or refresh interval does not change delivery mode or interrupt playback. Switching back to automatic mode applies only to future arrivals.
- Each entry in **Donation List & Alerts** has **Send to screen** / **Send again** controls. These queue its saved alert text after any alerts already waiting, preserving the amount, currency, and demo/test label. They never change totals or automatic duplicate detection. The campaign must be connected for its saved donation controls to appear.
- Alert display duration is 2–30 seconds **fully visible**, with animation time added before and after. In **Your overlays → Overlay animations**, set **Animation in** (both overlays) and **Alert animation out** independently from 0–10,000 ms; 0 is instant. Defaults are 500 ms in and 400 ms out. MustacheRider instead uses a 1.5-second cha-ching lead-in, fixed 3.6-second printing/tear/turn, a minimum 10-second hold that extends for long messages, and 1.4-second float-away sequence. For example, 800 ms in + 6 seconds visible + 300 ms out = 7.1 seconds total. Each alert keeps its theme, timing, and animation style until it finishes; subsequent alerts use the latest saved settings. **Test below** previews the complete alert cycle without sending an alert or sound to stream, and positioning tests use the saved timings too. The thermometer stays visible and counts increases over 500 ms; all motion has reduced-motion handling. Exceeded goals show their true percentage while the bar stops at 100%. A missing goal displays a neutral message.

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
- `src/shared/fonts.ts` contains the allowlisted Google Fonts. `src/client/shared/useGoogleFont.ts` loads the selected Custom or preset font CSS over the internet and handles sharing/cleanup. Do not bundle new Custom font files; bundled dashboard/preset fonts and their licenses are separate.
- Do not infer a successful OBS render from a send count: counts record server playback starts, even if no OBS browser source is open. Preserve this distinction in UI copy and documentation.
- Keep this document and relevant integration/theme notes aligned with changes. Keep README limited to app name, author, installation, and a short feature list.
- README overlay examples live in `docs/screenshots/custom-thermometer.png` and `custom-alert.png`. Capture the actual built graphics with the default Custom appearance and synthetic sample data at the OBS sizes (1000 × 180 and 1000 × 250, captured at 2× resolution). Never use real donor data, modify the operator's settings, or send live alerts to regenerate documentation screenshots.
