import type { CSSProperties } from 'react';
import { DEFAULT_ANIMATION_IN_MS, DEFAULT_ANIMATION_OUT_MS, defaultClassicColors, defaultCustomTheme, type ClassicColors, type CustomTheme, type OverlayTheme } from '../../shared/models';
import type { GraphicFont } from '../../shared/fonts';

export function overlayGoogleFont(theme: OverlayTheme, custom?: CustomTheme): GraphicFont | undefined {
  if (theme === 'classic') return custom?.fontFamily ?? 'Inter';
  if (theme === 'cyberpunk') return 'Rajdhani';
  if (theme === 'gta6') return 'Oswald';
  return undefined;
}

export function overlayMotionStyle(animationInMs = DEFAULT_ANIMATION_IN_MS, animationOutMs = DEFAULT_ANIMATION_OUT_MS): CSSProperties {
  return { '--overlay-in-duration': `${animationInMs}ms`, '--overlay-out-duration': `${animationOutMs}ms` } as CSSProperties;
}

// The persisted "classic" key keeps existing saved themes compatible; its UI name is Custom.
export function customThemeStyle(theme: OverlayTheme, colors: ClassicColors = defaultClassicColors, custom: CustomTheme = defaultCustomTheme): CSSProperties | undefined {
  if (theme !== 'classic') return undefined;
  return {
    '--graphic-font': `"${custom.fontFamily ?? 'Inter'}", Arial, sans-serif`,
    '--graphic-title-font': `"${custom.fontFamily ?? 'Inter'}", Arial, sans-serif`,
    '--graphic-ink': colors.font,
    '--graphic-accent': colors.accent,
    '--graphic-surface': colors.background,
    '--graphic-muted': `color-mix(in srgb, ${colors.font} 68%, ${colors.background})`,
    '--graphic-border': colors.accent,
    '--graphic-track': `color-mix(in srgb, ${colors.accent} 16%, ${colors.background})`,
    '--graphic-tint': `${colors.accent}16`,
    '--graphic-border-width': `${custom.borderWidth}px`,
    '--graphic-radius': custom.corners === 'rounded' ? '18px' : '0px',
    '--graphic-track-radius': custom.corners === 'rounded' ? '8px' : '0px',
    '--graphic-icon-radius': custom.corners === 'rounded' ? '50%' : '0px',
  } as CSSProperties;
}

export function overlayIcon(custom: CustomTheme = defaultCustomTheme) {
  return custom.iconEnabled ? custom.icon : null;
}
