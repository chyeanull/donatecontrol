# Overlay themes, fonts, and animation

For full product requirements and workflow, read [agent-context.md](agent-context.md). Dashboard typography and spacing come from [design.md](design.md); the Quest theme uses [quest-design.md](quest-design.md).

## Appearance and compatibility

The persistent `overlayAppearance` Replicant stores the selected theme, separate alert/thermometer animations, entrance/exit timings, Custom colors and frame controls, and the shared icon preferences. Operators edit drafts in **Your overlays**, then **Save Changes** validates and publishes them to both live graphics. Previews work without a provider, using labeled sample data; applying appearance never changes campaign totals or donation history.

- Display names: **Custom**, **Quest**, **BWF**, **Cyberkid**, **Grandsteal**, **Counter-Strike 2**, **MustacheRider**. Stored keys: `classic`, `quest`, `bwf`, `cyberpunk`, `gta6`, `cs2`, `mustacherider`. Keep `classic`, `cyberpunk`, and `gta6` for existing settings compatibility; theme renames change display labels only.
- Default theme: Custom. Default animation: Draw from left. `src/shared/appearance.ts` merges legacy shared-animation settings and missing optional fields with defaults.
- Custom includes font/accent/background color pickers and hex inputs, a whole-pixel border from 0–10 px, rounded/straight corners, and 20 Google Fonts. The border uses the exact accent color at full opacity. Font, border size, and corners share a compact row without group headings; the font wraps above the other fields on very narrow screens. Zero border is borderless.
- **Show icon** and the compact icon dropdown apply globally across all themes and both graphics, except MustacheRider, which uses its own thermometer artwork and receipt logo; its icon controls are hidden. The custom dropdown shows symbols and names in both the trigger and all options, with a checkmark for the selection. It supports arrows, Home/End, typeahead, Enter/Space selection, Escape cancellation, Tab, outside-click dismissal, and touch. The menu is portaled above other controls and positioned within the viewport. It closes and disables while Show icon is off or controls are unavailable. They are stored within `customTheme` for compatibility. Choose Heart, Happy face, Gift, Praying hands, Giving hand, Handshake, Star, Ribbon, Coin, or Sprout. Hiding the icon removes its layout space.
- Theme switching retains Custom settings; preset colors and typography remain theme-specific. Live graphics keep their existing URLs.
- The grey Apply column sits beside Overlay animations, sticks within the appearance section, and stops before Preview & connect. On small screens it becomes a bottom-sticky control within that section.

## Fonts and brand references

Dashboard body/monospace fonts (Inter, JetBrains Mono) are bundled under `src/client/dashboard/fonts/`; Raleway headings load from Google Fonts. Existing preset fonts (Cinzel, Spectral, Fira Code, Source Sans Pro) are bundled under `src/client/shared/fonts/`. Keep their SIL Open Font License notices alongside the assets.

Custom fonts load over the internet from Google Fonts; do not bundle them. The dropdown allowlist lives in `src/shared/fonts.ts`. `useGoogleFont` shares and cleans up selected-family stylesheet requests per document. A sans-serif fallback keeps text visible if loading fails. The default is Inter.

The 20 families captured from Google's popularity catalog on November 3, 2026 are Roboto, Open Sans, Google Sans, Inter, Montserrat, Poppins, Lato, Noto Sans JP, Arimo, Roboto Condensed, Noto Sans, Roboto Mono, Oswald, DM Sans, Raleway, Nunito, Nunito Sans, Playfair Display, Roboto Slab, and Ubuntu. This is a fixed allowlist, not a live ranking query.

BWF references checked October 11, 2026:

- [Identity](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/our-brand#identity)
- [Colors](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/our-brand#colors)
- [Typography](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/style#typography)

The guide specifies primary green `#47763B`, white `#FFFFFF`, charcoal `#373A36`, tan `#F0EFDD`; secondary navy `#021F4D` and green `#6ABF4B`. The implemented theme uses tan surfaces, green accents, charcoal text, navy headings, and Source Sans Pro regular/bold with Arial fallback. Foundation logos are not recreated. Dashboard typography is independent of overlay themes.

## Cyberkid and Grandsteal

Visual references inspected November 16, 2026: [Cyberpunk official site](https://www.cyberpunk.net/us/en/) and [GTA VI official site](https://www.rockstargames.com/VI). These themes use original CSS treatments rather than game logos, screenshots, or downloaded artwork.

- **Cyberkid:** electric yellow `#fcee0a`, ink `#0b1620`, cyan `#00e6f0`, cut-corner panels, square progress track, and condensed Rajdhani headings. The clipped backing is a pseudo-element so it does not override the entrance/exit clip paths or clip donor text.
- **Grandsteal:** violet `#21182f`, warm cream `#fff5e9`, pink `#ff9fbf`, peach `#ffc18a`, a sunset progress fill, and Oswald headings. Source Sans Pro keeps body text readable in both themes.

Rajdhani and Oswald load from Google Fonts using the shared reference-counted loader, with local sans-serif fallbacks; no new font assets are bundled. Rajdhani is preset-only and does not alter Custom's 20-font dropdown. Preset appearance remains fixed while global icon visibility/selection and each graphic's animation/timing remain configurable. Preview samples, live overlays, and saved appearance share the same styles and theme keys.

## Counter-Strike 2

The `cs2` preset uses charcoal `#202326`, warm white `#f4f1e9`, Counter-Strike orange `#f4a124`, square frames, and Roboto Condensed headings from Google Fonts. The image is a Catalana chicken rendered from the game model, sourced from [CS2Locker](https://cs2locker.com/pets); see [asset attribution](../src/client/shared/images/ATTRIBUTION.md). It is bundled locally through Vite for reliable preview and OBS rendering.

The chicken appears in the theme sample and both graphics, with dedicated space alongside the text. It remains visible independently of the optional global donation icon; normal icon controls, separate animations, timing, and long-message fitting still apply. The thermometer enters once and stays on screen.

## MustacheRider

The `mustacherider` preset uses the owner's original SVGs, unchanged, in `src/client/shared/images/mustacherider/`. The original PNG visual references are preserved in `docs/theme-references/mustacherider/`. The thermometer has a transparent background and layers the bun beneath the mustard. A unique SVG clip reveals the mustard horizontally across its actual visible path bounds (x 101.5919–690.7498), using `raised / goal`; never resize the mustard itself or calculate the fill from the wider SVG canvas. The clip is a capsule with a 33px radius in the SVG viewBox, covering the mustard’s vertical bounds; its left padding preserves the artwork’s start, and its leading edge follows the funding ratio. The initial draw animates this same rounded mask. Zero donations show no mustard; at 100% the cap clears the original artwork end, and exceeded goals stay full. Donation and goal updates transition the mask over 2400 ms using the shared ease-in-out curve, with no motion under reduced-motion preferences. A new update during the transition retargets from the current visible fill rather than restarting at zero. The hot dog enters from below with a small jiggle over 900 ms, followed by an 1800 ms mustard reveal. The thermometer remains visible and never replays its entrance on funding updates. Idle dashboard samples stay static.

Six brown (`#7a4b0c`) cash labels span zero through the effective campaign goal in fifths. They use compact currency notation and **Rubik Spray Paint**, loaded from Google Fonts at its available 400 weight. Labels are 28px in the SVG viewBox, with an en-space on each side of the vertical dividers for breathing room. It is preset-only; Custom keeps its existing 20-family dropdown. Provider goal updates and Movember custom goals/reset update both labels and fill immediately. Missing goals show “Goal not set” and no mustard. Exact raised/goal values remain in the thermometer's accessible label.

Use **1000 × 360** for the MustacheRider thermometer in OBS to preserve the artwork's proportions at full width; other canvas sizes contain the whole artwork without cropping. The alert uses a **1920 × 1080** transparent stage and a printed receipt: off-white paper, torn edges, the owner-supplied Mustachio logo, bundled Fira Code text, donor name, amount, full donation message, TEST PRINT for test data, and a decorative barcode. It stays 48px from the right and bottom with a fixed 640px paper width and natural height. Long text makes the paper taller without shrinking its width or typography, up to a 984px maximum that leaves 48px above and below it. Once capped, only the message scrolls during the hold: one second after the paper settles, a slow scroll using the message’s reading time, and one second on the final lines. Long messages extend the hold automatically instead of being squeezed into eight seconds. Reduced motion uses instant page changes; idle previews permit manual message scrolling. The donor, amount, and footer remain visible. Only the complete stage scales for dashboard previews. The compact header has a centered 112px Mustachio logo and one row containing the name and amount, both bold; omit DONATION RECEIPT and RECEIVED FROM headings. Messages use 30px type, the small TEST PRINT marker sits in the footer, and the torn-edge notches stay 6px deep at any height. Both MustacheRider graphics ignore the shared donation icon, whose settings remain available on other themes.

Custom motion is mandatory for this theme. The standard animation selectors and speed fields are disabled, and the applied theme disables the Alert Settings duration field at 10 seconds; switching away restores the saved controls. The hot dog uses CSS transform keyframes followed by a clip reveal. The receipt uses Web Animations with transform/opacity: a hidden 1500ms cha-ching lead-in, then twelve printing steps from the right edge while rotated -90° (2400ms), a tear-off tug (300ms), rotation upright (900ms), a fully visible hold of at least 10 seconds, extended for long messages, and a swaying exit through the bottom (1400ms). Minimum queue time is 16500ms; long messages add reading time. Easing uses the shared strong ease-out/ease-in-out tokens. Reduced motion uses gentle fades and retains the queue schedule.

MustacheRider uses built-in cha-ching (0–1500ms), printer (1500–3900ms), and rip (3900ms) sounds from `src/client/shared/audio/mustacherider/`. `mustacheRiderAudio.ts` shares the visual timing constants, cancels all cues when playback stops, and supports volume changes without restarting. The global upload is disabled for this applied theme, its saved file is retained, and the shared volume controls the built-in sounds (0 mutes). Live alerts and live tests play the cues; the local sound-test button uses the same sequence. Dashboard visual previews and positioning tests remain silent.

`src/shared/mustacheRider.ts` owns timing constants shared by the server and graphics. `resolveAlertPlayback` snapshots each alert's theme, message-dependent hold, and animation timings. `mustacheRiderHoldMs` budgets 1.6 seconds per estimated reading line (25 text cells, with explicit newlines and wide text counted) once the message exceeds 10 estimated lines. The server resolves this from the donation at playback start, so queued edits receive the correct time. The graphic uses the captured hold minus a one-second pause at each end for linear scrolling; reduced motion gives every page, including the last, an equal share of that reading interval. Do not swap its canvas or shorten it if appearance/settings change mid-alert. Preview & connect's Test below and the direct positioning-test URL run the same sequence; the idle preview remains upright. Receipt rendering/fitting lives in `MustacheRiderReceipt.tsx`, routed by `AlertGraphic.tsx` separately from the other themes' 1000 × 250 AlertCanvas.

## Panels and testing

`src/shared/dashboard.ts` defines four native fullbleed panels: **01 · Campaign**, **02 · Your overlays**, **03 · Alert Settings**, **04 · Donation List & Alerts**. The build generates manifest labels/order from that definition. NodeCG owns navigation when embedded; standalone pages render their own links. Existing `control.html` and both OBS graphic URLs remain valid.

**Preview & connect** provides two different actions:

- **Test below** replays dashboard graphics with unsaved draft appearance and timings. It is silent and never queues an on-stream donation.
- **Test on live overlay** queues an explicit test alert using applied appearance and saved sound. It does not affect campaign totals or donation history, and works disconnected or in manual mode.

The positioning-test URL (`?test=1`), available by adding the parameter directly rather than a dashboard link, shows local samples independently of live playback and remains silent. Remove that parameter for actual stream alerts. Demo playground appears only while the Mock provider is connected. There is no separate Testing section or global header test button.

## Animation and fitting

Choose **Draw from left**, **Rise & fade**, **Soft zoom**, **Slide from right**, or **Center reveal** separately for the alert and thermometer. Animation in controls both entrances; alert animation out controls only the alert exit. Both accept 0–10,000 ms, with zero meaning instant; defaults are 500 ms in and 400 ms out.

Slide from right brings the whole frame in from the right edge, easing to rest as details fade in. Center reveal opens a symmetrical clip from the center without scaling or moving the text. Alert exits reverse the entrance path. These adapt the directional slide pattern in [Material UI's React transitions](https://mui.com/material-ui/transitions/#slide) and the clip-path reveal technique in [Motion's React guide](https://motion.dev/docs/react-scroll-animations). Both use the existing CSS transitions, easing token, timing controls, and reduced-motion fade; no animation library is required. References reviewed November 3, 2026.

Info icons beside the four timing fields explain duration, polling, and animation speed on hover, keyboard focus, or tap. Escape and clicking outside dismiss them; tooltips are positioned within the viewport. The removed helper paragraphs stay out of the page content.

Alert duration in Alert Settings is the fully visible hold time (2–30 seconds). Total playback time is entrance + hold + exit. Each active alert snapshots its theme, hold, transition timings, and animation style; new settings apply to subsequent alerts. MustacheRider uses a minimum 10-second hold and 16.5-second total sequence, with extra reading time for long messages. Preserve interruption cleanup and reduced-motion handling.

The thermometer enters once when its graphic loads, then stays visible while connected. Changing its saved animation style does not replay the entrance. It has no timed exit; raised totals and progress grow with donations. Reduced motion disables number counting and uses restrained fades instead of directional movement.

OBS canvases are **1000 × 180** for the thermometer (**1000 × 360** for MustacheRider) and **1000 × 250** for alerts (**1920 × 1080** for MustacheRider receipts). Long donor names and messages wrap; they must not be line-clamped or clipped at descenders. The shared `AlertCanvas` measures and scales the entire alert card to fit the available canvas, including in dashboard previews. Very long messages become smaller. Keep the content width bounded so unbroken text cannot produce an unbounded intrinsic layout.

The November 16, 2026 additions passed TypeScript validation, the 19-case appearance suite, and a production build. An isolated NodeCG browser check covered both themes before connection, Save Changes/reload, the live 1000 × 180 thermometer and 1000 × 250 alert, icon visibility/selection, long-message fitting, and the 320px dashboard. The existing main campaign appearance was not used for test alerts.

MustacheRider was checked November 17, 2026 with TypeScript, 22 focused scale/appearance tests, and a production build. Isolated browser samples covered the actual built graphics, Google font loading, 0/20/60/100/over-goal masks, persistent donation updates, custom goal recalculation, missing goals, the simple alert, disconnected previews, unique clip IDs, and desktop/320px layouts. These checks did not change operator settings or send alerts to stream.

The MustacheRider receipt/custom-motion update passed TypeScript, 32 focused appearance/scale/queue-timing tests, and a production build. Isolated browser checks inspected printing, tear, turn, hold and exit frames; the 15-second dashboard cycle; bottom-right fitting and long text; captured themes; hot dog sequence/persistent updates; disabled controls; desktop/mobile layouts; and reduced motion. Operator data was not used for test alerts.

The November 18, 2026 receipt-audio update passed TypeScript, 17 focused audio/storage/queue-timing tests, and a production build. An isolated Chromium check decoded all three bundled MP3s, measured cue starts at 0/201/2401ms, verified printer cancellation at tear-off and on early dismissal, checked resend/volume/theme behavior, and inspected desktop/320px sound controls. No operator data or live stream alerts were used.

The subsequent cha-ching lead-in change passed TypeScript, 14 focused audio/queue tests, and a production build. Isolated browser playback verified the complete cash chime finished before printing, no receipt was visible during the lead-in, printer/rip cues began at 4001/6401ms, early cancellation did not flash the paper, and reduced motion kept the same hidden lead-in. Queue tests preserve the full 10-second hold within the new 19-second cycle.

The cha-ching lead-in was subsequently shortened to 1500ms, with the chime stopped when printing begins. TypeScript, the 14 focused audio/queue tests, and the production build passed again; the queue retains the full 10-second hold within the 16.5-second cycle.

Long-message reading time now extends the server queue and graphic together. TypeScript, 29 focused timing/audio/logic checks, and the production build passed. An isolated browser check verified the one-second pause after the entrance, slower linear scrolling, the final lines remaining visible, equal reading time for reduced-motion pages, cancellation, and a contained mobile preview. No live test alerts were sent.
