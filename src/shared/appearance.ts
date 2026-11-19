import { DEFAULT_ANIMATION_IN_MS, DEFAULT_ANIMATION_OUT_MS, defaultClassicColors, defaultCustomTheme, type Replicants } from './models';
import { mustacheRiderHoldMs, mustacheRiderMotion } from './mustacheRider';

export function resolveOverlayAppearance(value: Replicants['overlayAppearance'], previous?: Replicants['overlayAppearance']) {
  const legacyAnimation = value.animation ?? previous?.animation ?? 'draw-left';
  const alertAnimation = value.alertAnimation ?? previous?.alertAnimation ?? legacyAnimation;
  const thermometerAnimation = value.thermometerAnimation ?? previous?.thermometerAnimation ?? legacyAnimation;
  return {
    theme: value.theme,
    animation: alertAnimation,
    alertAnimation,
    thermometerAnimation,
    classicColors: { ...(value.classicColors ?? previous?.classicColors ?? defaultClassicColors) },
    customTheme: { ...defaultCustomTheme, ...previous?.customTheme, ...value.customTheme },
    animationInMs: value.animationInMs ?? previous?.animationInMs ?? DEFAULT_ANIMATION_IN_MS,
    animationOutMs: value.animationOutMs ?? previous?.animationOutMs ?? DEFAULT_ANIMATION_OUT_MS,
  };
}

export function parseHexColor(value: string): string | undefined {
  const hex = value.trim().replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : undefined;
}

export function resolveAlertPlayback(value: Replicants['overlayAppearance'], durationSeconds: number, message?: string) {
  const appearance = resolveOverlayAppearance(value);
  const custom = appearance.theme === 'mustacherider';
  return {
    theme: appearance.theme,
    animation: appearance.alertAnimation,
    animationInMs: custom ? mustacheRiderMotion.alertInMs : appearance.animationInMs,
    animationOutMs: custom ? mustacheRiderMotion.alertOutMs : appearance.animationOutMs,
    holdMs: custom ? mustacheRiderHoldMs(message) : Math.round(durationSeconds * 1000),
  };
}
