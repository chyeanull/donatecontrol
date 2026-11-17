// Google Fonts popularity snapshot, 2026-11-03. Source: https://fonts.google.com/metadata/fonts. Font files load from Google.
export const overlayFonts = [
  "Roboto",
  "Open Sans",
  "Google Sans",
  "Inter",
  "Montserrat",
  "Poppins",
  "Lato",
  "Noto Sans JP",
  "Arimo",
  "Roboto Condensed",
  "Noto Sans",
  "Roboto Mono",
  "Oswald",
  "DM Sans",
  "Raleway",
  "Nunito",
  "Nunito Sans",
  "Playfair Display",
  "Roboto Slab",
  "Ubuntu"
] as const;
export type OverlayFont = typeof overlayFonts[number];
// Preset-only fonts do not expand the Custom theme's 20-family dropdown.
export type GraphicFont = OverlayFont | 'Rajdhani' | 'Rubik Spray Paint';
