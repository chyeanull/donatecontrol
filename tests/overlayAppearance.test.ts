import { describe, expect, it } from 'vitest';
import { defaultAlertPlayback, defaultClassicColors, defaultCustomTheme, donationIconSchema, overlayAppearanceSchema } from '../src/shared/models';
import { parseHexColor, resolveOverlayAppearance } from '../src/shared/appearance';
import { overlayFonts } from '../src/shared/fonts';
import { customThemeStyle, overlayIcon } from '../src/client/shared/appearance';

describe('overlay appearance compatibility and colors', () => {
  const colors = { font: '#eef2ff', accent: '#ff8844', background: '#102030' };

  it('loads saved themes from before animation and color controls existed', () => {
    const legacy = overlayAppearanceSchema.parse({ theme: 'quest' });
    expect(resolveOverlayAppearance(legacy)).toEqual({ theme: 'quest', ...defaultAlertPlayback, alertAnimation: 'draw-left', thermometerAnimation: 'draw-left', classicColors: defaultClassicColors, customTheme: defaultCustomTheme });
  });

  it('preserves custom colors when an older client changes the theme', () => {
    const saved = overlayAppearanceSchema.parse({ theme: 'classic', animation: 'soft-zoom', animationInMs: 1200, animationOutMs: 700, classicColors: colors });
    const changed = resolveOverlayAppearance({ theme: 'bwf' }, saved);
    expect(changed).toEqual({ theme: 'bwf', animation: 'soft-zoom', alertAnimation: 'soft-zoom', thermometerAnimation: 'soft-zoom', animationInMs: 1200, animationOutMs: 700, classicColors: colors, customTheme: defaultCustomTheme });
    expect(resolveOverlayAppearance(JSON.parse(JSON.stringify(changed))).classicColors).toEqual(colors);
  });

  it('migrates a shared animation to both overlays without resetting the saved choice', () => {
    for (const animation of ['draw-left', 'rise-fade', 'soft-zoom'] as const) {
      expect(resolveOverlayAppearance({ theme: 'classic', animation })).toMatchObject({ alertAnimation: animation, thermometerAnimation: animation });
    }
  });

  it.each([
    ['soft-zoom', 'draw-left'], ['slide-right', 'center-reveal'], ['center-reveal', 'slide-right'],
  ] as const)('preserves separate styles %s / %s across reloads and older client updates', (alertAnimation, thermometerAnimation) => {
    const saved = resolveOverlayAppearance(overlayAppearanceSchema.parse({ theme: 'classic', alertAnimation, thermometerAnimation, animationInMs: 800, animationOutMs: 300 }));
    const reloaded = resolveOverlayAppearance(JSON.parse(JSON.stringify(saved)));
    expect(reloaded).toEqual(saved);
    expect(resolveOverlayAppearance({ theme: 'quest', animation: 'rise-fade' }, reloaded)).toMatchObject({
      theme: 'quest', alertAnimation, thermometerAnimation, animationInMs: 800, animationOutMs: 300,
    });
  });

  it('changes one overlay without changing the other', () => {
    const previous = resolveOverlayAppearance({ theme: 'classic', alertAnimation: 'soft-zoom', thermometerAnimation: 'draw-left' });
    expect(resolveOverlayAppearance({ theme: 'classic', thermometerAnimation: 'rise-fade' }, previous)).toMatchObject({
      alertAnimation: 'soft-zoom', thermometerAnimation: 'rise-fade', animation: 'soft-zoom',
    });
    expect(resolveOverlayAppearance({ theme: 'classic', alertAnimation: 'rise-fade' }, previous)).toMatchObject({
      alertAnimation: 'rise-fade', thermometerAnimation: 'draw-left', animation: 'rise-fade',
    });
  });

  it('validates each overlay style independently', () => {
    expect(overlayAppearanceSchema.safeParse({ theme: 'classic', alertAnimation: 'spin', thermometerAnimation: 'draw-left' }).success).toBe(false);
    expect(overlayAppearanceSchema.safeParse({ theme: 'classic', alertAnimation: 'soft-zoom', thermometerAnimation: null }).success).toBe(false);
  });

  it('accepts instant and bounded whole-millisecond timings but rejects invalid values', () => {
    const saved = resolveOverlayAppearance({ theme: 'classic', animationInMs: 1200, animationOutMs: 700 });
    expect(resolveOverlayAppearance({ theme: 'classic', animationInMs: 0, animationOutMs: 0 }, saved)).toMatchObject({ animationInMs: 0, animationOutMs: 0 });
    expect(overlayAppearanceSchema.parse({ theme: 'classic', animationInMs: 10000, animationOutMs: 0 })).toMatchObject({ animationInMs: 10000, animationOutMs: 0 });
    for (const value of [-1, 10001, 1.5, NaN, Infinity, '500', null]) {
      expect(overlayAppearanceSchema.safeParse({ theme: 'classic', animationInMs: value }).success).toBe(false);
      expect(overlayAppearanceSchema.safeParse({ theme: 'classic', animationOutMs: value }).success).toBe(false);
    }
  });

  it('rejects malformed or incomplete color updates before saving', () => {
    for (const font of ['red', '#fff', '#12345678', '#gggggg', 'var(--ink)', '']) {
      expect(overlayAppearanceSchema.safeParse({ theme: 'classic', classicColors: { ...colors, font } }).success).toBe(false);
    }
    expect(overlayAppearanceSchema.safeParse({ theme: 'classic', classicColors: { font: colors.font } }).success).toBe(false);
    expect(overlayAppearanceSchema.parse({ theme: 'classic', classicColors: colors }).classicColors).toEqual(colors);
  });

  it('accepts hex input with or without a hash and normalizes case', () => {
    expect(parseHexColor(' EEF2FF ')).toBe('#eef2ff');
    expect(parseHexColor('#FF8844')).toBe('#ff8844');
    expect(parseHexColor('#12')).toBeUndefined();
    expect(parseHexColor('##123456')).toBeUndefined();
  });

  it('limits custom colors to Custom, including its secondary text and trim', () => {
    expect(customThemeStyle('classic', colors)).toMatchObject({
      '--graphic-ink': colors.font, '--graphic-accent': colors.accent, '--graphic-surface': colors.background,
      '--graphic-muted': 'color-mix(in srgb, #eef2ff 68%, #102030)',
      '--graphic-border': colors.accent,
    });
    expect(customThemeStyle('quest', colors)).toBeUndefined();
    expect(customThemeStyle('bwf', colors)).toBeUndefined();
  });

  it('keeps old Custom colors and uses the original border, corners, and heart for saved Classic themes', () => {
    const migrated = resolveOverlayAppearance({ theme: 'classic', classicColors: colors });
    expect(migrated.theme).toBe('classic');
    expect(migrated.classicColors).toEqual(colors);
    expect(migrated.customTheme).toEqual(defaultCustomTheme);
  });

  it('preserves Custom options across theme changes, older clients, and reloads', () => {
    const customTheme = { borderWidth: 10, corners: 'straight' as const, iconEnabled: false, icon: 'praying-hands' as const };
    const saved = resolveOverlayAppearance(overlayAppearanceSchema.parse({ theme: 'classic', classicColors: colors, customTheme }));
    const changed = resolveOverlayAppearance({ theme: 'quest' }, saved);
    const reloaded = resolveOverlayAppearance(JSON.parse(JSON.stringify(changed)));
    expect(resolveOverlayAppearance({ theme: 'classic' }, reloaded)).toMatchObject({ classicColors: colors, customTheme });
  });

  it('allows borderless overlays and caps borders at ten whole pixels', () => {
    for (const borderWidth of [0, 1, 10]) {
      expect(overlayAppearanceSchema.parse({ theme: 'classic', customTheme: { ...defaultCustomTheme, borderWidth } }).customTheme?.borderWidth).toBe(borderWidth);
    }
    for (const borderWidth of [-1, 11, 1.5, NaN, Infinity, '10', null]) {
      expect(overlayAppearanceSchema.safeParse({ theme: 'classic', customTheme: { ...defaultCustomTheme, borderWidth } }).success).toBe(false);
    }
  });

  it('accepts the ten icon choices and rejects malformed Custom options', () => {
    expect(donationIconSchema.options).toHaveLength(10);
    for (const icon of donationIconSchema.options) {
      expect(overlayAppearanceSchema.parse({ theme: 'classic', customTheme: { ...defaultCustomTheme, icon } }).customTheme?.icon).toBe(icon);
    }
    for (const patch of [{ icon: 'unknown' }, { iconEnabled: 'false' }, { corners: 'circle' }]) {
      expect(overlayAppearanceSchema.safeParse({ theme: 'classic', customTheme: { ...defaultCustomTheme, ...patch } }).success).toBe(false);
    }
    expect(overlayAppearanceSchema.safeParse({ theme: 'classic', customTheme: { borderWidth: 10 } }).success).toBe(false);
  });

  it('limits frame options to Custom while sharing icon options across themes', () => {
    const custom = { ...defaultCustomTheme, borderWidth: 10, corners: 'straight' as const, icon: 'gift' as const };
    expect(customThemeStyle('classic', colors, custom)).toMatchObject({ '--graphic-border-width': '10px', '--graphic-radius': '0px', '--graphic-track-radius': '0px' });
    expect(customThemeStyle('classic', colors, defaultCustomTheme)).toMatchObject({ '--graphic-border-width': '1px', '--graphic-radius': '18px' });
    expect(overlayIcon(custom)).toBe('gift');
    expect(overlayIcon({ ...custom, iconEnabled: false })).toBeNull();
    for (const theme of ['quest', 'bwf', 'cyberpunk', 'gta6'] as const) {
      expect(customThemeStyle(theme, colors, custom)).toBeUndefined();
      expect(overlayIcon({ ...custom, iconEnabled: false })).toBeNull();
    }
  });
  it('preserves the selected font when loading old settings or changing themes', () => {
    const saved = resolveOverlayAppearance({ theme: 'classic', customTheme: { ...defaultCustomTheme, fontFamily: 'Playfair Display' } });
    const legacy = { borderWidth: 4, corners: 'straight' as const, iconEnabled: false, icon: 'gift' as const };
    const changed = resolveOverlayAppearance({ theme: 'quest', customTheme: legacy }, saved);
    expect(changed.customTheme).toEqual({ ...legacy, fontFamily: 'Playfair Display' });
    expect(resolveOverlayAppearance(JSON.parse(JSON.stringify(changed)))).toEqual(changed);
    expect(overlayIcon(changed.customTheme)).toBeNull();
    expect(overlayIcon({ ...changed.customTheme, iconEnabled: true })).toBe('gift');
  });

  it('accepts only the 20 curated font families', () => {
    expect(new Set(overlayFonts).size).toBe(20);
    for (const fontFamily of overlayFonts) {
      const customTheme = { ...defaultCustomTheme, fontFamily };
      expect(overlayAppearanceSchema.safeParse({ theme: 'classic', customTheme }).success).toBe(true);
      expect(customThemeStyle('classic', colors, customTheme)).toMatchObject({ '--graphic-font': `"${fontFamily}", Arial, sans-serif`, '--graphic-title-font': `"${fontFamily}", Arial, sans-serif` });
    }
    for (const fontFamily of ['', 'Unknown Font', 'url(https://example.com/font)', null, 10]) {
      expect(overlayAppearanceSchema.safeParse({ theme: 'classic', customTheme: { ...defaultCustomTheme, fontFamily } }).success).toBe(false);
    }
  });

});
