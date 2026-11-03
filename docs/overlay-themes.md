# Overlay themes, fonts, and animation

For full product requirements and workflow, read [agent-context.md](agent-context.md). Dashboard typography and spacing come from [design.md](design.md); the Quest theme uses [quest-design.md](quest-design.md).

## Appearance and compatibility

The persistent `overlayAppearance` Replicant stores the selected theme, separate alert/thermometer animations, entrance/exit timings, Custom colors and frame controls, and the shared icon preferences. Operators edit drafts in **Your overlays**, then **Apply to overlays** validates and publishes them to both live graphics. Previews work without a provider, using labeled sample data; applying appearance never changes campaign totals or donation history.

- Display names: **Custom**, **Quest**, **BWF**. Stored keys: `classic`, `quest`, `bwf`. Keep `classic` for existing settings compatibility.
- Default theme: Custom. Default animation: Draw from left. `src/shared/appearance.ts` merges legacy shared-animation settings and missing optional fields with defaults.
- Custom includes font/accent/background color pickers and hex inputs, a whole-pixel border from 0–10 px, rounded/straight corners, and 20 Google Fonts. Zero border is borderless.
- **Show icon** and the icon picker apply globally across all themes and both graphics. They are stored within `customTheme` for compatibility. Choose Heart, Happy face, Gift, Praying hands, Giving hand, Handshake, Star, Ribbon, Coin, or Sprout. Hiding the icon removes its layout space.
- Theme switching retains Custom settings; preset colors and typography remain theme-specific. Live graphics keep their existing URLs.
- The grey Apply column sits beside Overlay animations, sticks within the appearance section, and stops before Preview & connect. On small screens it becomes a bottom-sticky control within that section.

## Fonts and brand references

Dashboard fonts (Anton, Inter, JetBrains Mono) are bundled under `src/client/dashboard/fonts/`. Preset fonts (Cinzel, Spectral, Fira Code, Source Sans Pro) are bundled under `src/client/shared/fonts/`. Keep their SIL Open Font License notices alongside the assets.

Custom fonts load over the internet from Google Fonts; do not bundle them. The dropdown allowlist lives in `src/shared/fonts.ts`. `useGoogleFont` shares and cleans up selected-family stylesheet requests per document. A sans-serif fallback keeps text visible if loading fails. The default is Inter.

The 20 families captured from Google's popularity catalog on November 3, 2026 are Roboto, Open Sans, Google Sans, Inter, Montserrat, Poppins, Lato, Noto Sans JP, Arimo, Roboto Condensed, Noto Sans, Roboto Mono, Oswald, DM Sans, Raleway, Nunito, Nunito Sans, Playfair Display, Roboto Slab, and Ubuntu. This is a fixed allowlist, not a live ranking query.

BWF references checked October 11, 2026:

- [Identity](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/our-brand#identity)
- [Colors](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/our-brand#colors)
- [Typography](https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/style#typography)

The guide specifies primary green `#47763B`, white `#FFFFFF`, charcoal `#373A36`, tan `#F0EFDD`; secondary navy `#021F4D` and green `#6ABF4B`. The implemented theme uses tan surfaces, green accents, charcoal text, navy headings, and Source Sans Pro regular/bold with Arial fallback. Foundation logos are not recreated. Dashboard typography is independent of overlay themes.

## Panels and testing

`src/shared/dashboard.ts` defines four native fullbleed panels: **01 · Main**, **02 · Your overlays**, **03 · Alert Settings**, **04 · Donation List & Alerts**. The build generates manifest labels/order from that definition. NodeCG owns navigation when embedded; standalone pages render their own links. Existing `control.html` and both OBS graphic URLs remain valid.

**Preview & connect** provides two different actions:

- **Test below** replays dashboard graphics with unsaved draft appearance and timings. It is silent and never queues an on-stream donation.
- **Test on live overlay** queues an explicit test alert using applied appearance and saved sound. It does not affect campaign totals or donation history, and works disconnected or in manual mode.

The positioning-test URL (`?test=1`) shows local samples independently of live playback and remains silent. Remove that parameter for actual stream alerts. Demo playground appears only while the Mock provider is connected. There is no separate Testing section or global header test button.

## Animation and fitting

Choose **Draw from left**, **Rise & fade**, or **Soft zoom** separately for the alert and thermometer. Animation in controls both entrances; alert animation out controls only the alert exit. Both accept 0–10,000 ms, with zero meaning instant; defaults are 500 ms in and 400 ms out.

Alert duration in Alert Settings is the fully visible hold time (2–30 seconds). Total playback time is entrance + hold + exit. Each active alert snapshots its timings and animation style; new settings apply to subsequent alerts. Preserve interruption cleanup and reduced-motion handling.

The thermometer enters once when its graphic loads, then stays visible while connected. Changing its saved animation style does not replay the entrance. It has no timed exit; raised totals and progress grow with donations. Reduced motion disables number counting and uses restrained fades instead of directional movement.

OBS canvases are **1000 × 180** for the thermometer and **1000 × 250** for alerts. Long donor names and messages wrap; they must not be line-clamped or clipped at descenders. The shared `AlertCanvas` measures and scales the entire alert card to fit the available canvas, including in dashboard previews. Very long messages become smaller. Keep the content width bounded so unbroken text cannot produce an unbounded intrinsic layout.
