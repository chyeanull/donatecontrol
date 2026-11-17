# Overlay themes, fonts, and animation

For full product requirements and workflow, read [agent-context.md](agent-context.md). Dashboard typography and spacing come from [design.md](design.md); the Quest theme uses [quest-design.md](quest-design.md).

## Appearance and compatibility

The persistent `overlayAppearance` Replicant stores the selected theme, separate alert/thermometer animations, entrance/exit timings, Custom colors and frame controls, and the shared icon preferences. Operators edit drafts in **Your overlays**, then **Save Changes** validates and publishes them to both live graphics. Previews work without a provider, using labeled sample data; applying appearance never changes campaign totals or donation history.

- Display names: **Custom**, **Quest**, **BWF**, **Cyberkid**, **Grandsteal**, **Counter-Strike 2**. Stored keys: `classic`, `quest`, `bwf`, `cyberpunk`, `gta6`, `cs2`. Keep `classic`, `cyberpunk`, and `gta6` for existing settings compatibility; theme renames change display labels only.
- Default theme: Custom. Default animation: Draw from left. `src/shared/appearance.ts` merges legacy shared-animation settings and missing optional fields with defaults.
- Custom includes font/accent/background color pickers and hex inputs, a whole-pixel border from 0–10 px, rounded/straight corners, and 20 Google Fonts. The border uses the exact accent color at full opacity. Font, border size, and corners share a compact row without group headings; the font wraps above the other fields on very narrow screens. Zero border is borderless.
- **Show icon** and the compact icon dropdown apply globally across all themes and both graphics. The custom dropdown shows symbols and names in both the trigger and all options, with a checkmark for the selection. It supports arrows, Home/End, typeahead, Enter/Space selection, Escape cancellation, Tab, outside-click dismissal, and touch. The menu is portaled above other controls and positioned within the viewport. It closes and disables while Show icon is off or controls are unavailable. They are stored within `customTheme` for compatibility. Choose Heart, Happy face, Gift, Praying hands, Giving hand, Handshake, Star, Ribbon, Coin, or Sprout. Hiding the icon removes its layout space.
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

Alert duration in Alert Settings is the fully visible hold time (2–30 seconds). Total playback time is entrance + hold + exit. Each active alert snapshots its timings and animation style; new settings apply to subsequent alerts. Preserve interruption cleanup and reduced-motion handling.

The thermometer enters once when its graphic loads, then stays visible while connected. Changing its saved animation style does not replay the entrance. It has no timed exit; raised totals and progress grow with donations. Reduced motion disables number counting and uses restrained fades instead of directional movement.

OBS canvases are **1000 × 180** for the thermometer and **1000 × 250** for alerts. Long donor names and messages wrap; they must not be line-clamped or clipped at descenders. The shared `AlertCanvas` measures and scales the entire alert card to fit the available canvas, including in dashboard previews. Very long messages become smaller. Keep the content width bounded so unbroken text cannot produce an unbounded intrinsic layout.

The November 16, 2026 additions passed TypeScript validation, the 19-case appearance suite, and a production build. An isolated NodeCG browser check covered both themes before connection, Save Changes/reload, the live 1000 × 180 thermometer and 1000 × 250 alert, icon visibility/selection, long-message fitting, and the 320px dashboard. The existing main campaign appearance was not used for test alerts.
