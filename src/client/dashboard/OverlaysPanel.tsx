import { useEffect, useRef, useState } from 'react';
import { Thermometer } from '../shared/Graphics';
import { graphicUrl, useReplicant } from '../shared/nodecg';
import { DEFAULT_ANIMATION_IN_MS, DEFAULT_ANIMATION_OUT_MS, MAX_ANIMATION_MS, animationMsSchema, customBorderWidthSchema, defaultClassicColors, emptyCampaign, overlayAnimationNames, type DonationAlert, type OverlayTheme, type OverlayAnimation } from '../../shared/models';
import { parseHexColor, resolveOverlayAppearance } from '../../shared/appearance';
import { customThemeStyle, overlayIcon } from '../shared/appearance';
import { DonationIcon } from '../shared/DonationIcon';
import { PanelLayout, SectionTitle, Icon, useControls } from './PanelLayout';
import { OverlayCard } from './OverlayCard';
import { AlertPreview } from './AlertPreview';
import { DemoPlayground } from './DemoPlayground';
import { ClassicColorControls } from './ClassicColorControls';
import { CustomThemeControls } from './CustomThemeControls';
import { OverlayIconControls } from './OverlayIconControls';
import { notify } from './notifications';

const themes = [
  { id: 'classic', name: 'Custom', description: 'Make it yours with custom fonts, colors, borders, and corners.' },
  { id: 'quest', name: 'Quest', description: 'Parchment lettering, antique gold, and an ornate frame for your campaign.' },
  { id: 'bwf', name: 'BWF', description: 'Foundation green, warm tan, and Source Sans Pro, drawn from the BWF brand guide.' },
] as const;
const animationDescriptions: Record<OverlayAnimation, string> = {
  'draw-left': 'The frame draws from left to right, followed by the title, amounts, and progress bar.',
  'rise-fade': 'The overlay lifts gently into place, with its details fading in one after another.',
  'soft-zoom': 'The overlay softly scales into view, followed by a subtle reveal of each detail.',
};
const sampleCampaign = { ...emptyCampaign, title: 'Together, we can.', raised: 12500, goal: 25000, percent: 50 };

export function OverlaysPanel() {
  const controls = useControls();
  const { connected, disabled, busy, run, settings } = controls;
  const appearance = resolveOverlayAppearance(useReplicant('overlayAppearance'));
  const campaign = useReplicant('campaign');
  const alert = useReplicant('currentAlert');
  const [selected, setSelected] = useState<OverlayTheme>(appearance.theme);
  const [alertAnimation, setAlertAnimation] = useState<OverlayAnimation>(appearance.alertAnimation);
  const [thermometerAnimation, setThermometerAnimation] = useState<OverlayAnimation>(appearance.thermometerAnimation);
  const savedInMs = appearance.animationInMs ?? DEFAULT_ANIMATION_IN_MS;
  const savedOutMs = appearance.animationOutMs ?? DEFAULT_ANIMATION_OUT_MS;
  const [inInput, setInInput] = useState(String(savedInMs));
  const [outInput, setOutInput] = useState(String(savedOutMs));
  const inValue = inInput.trim() ? Number(inInput) : NaN;
  const outValue = outInput.trim() ? Number(outInput) : NaN;
  const inValid = animationMsSchema.safeParse(inValue).success;
  const outValid = animationMsSchema.safeParse(outValue).success;
  const animationInMs = inValid ? inValue : savedInMs;
  const animationOutMs = outValid ? outValue : savedOutMs;
  const savedColors = appearance.classicColors ?? defaultClassicColors;
  const [colorInputs, setColorInputs] = useState(savedColors);
  const savedCustomTheme = appearance.customTheme;
  const [customOptions, setCustomOptions] = useState(savedCustomTheme);
  const [borderInput, setBorderInput] = useState(String(savedCustomTheme.borderWidth));
  const borderValue = borderInput.trim() ? Number(borderInput) : NaN;
  const borderValid = customBorderWidthSchema.safeParse(borderValue).success;
  const customTheme = { ...customOptions, borderWidth: borderValid ? borderValue : savedCustomTheme.borderWidth };
  const [alertPreviewVisible, setAlertPreviewVisible] = useState(true);
  const [testing, setTesting] = useState(false);
  const [previewCycle, setPreviewCycle] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => setSelected(appearance.theme), [appearance.theme]);
  useEffect(() => setAlertAnimation(appearance.alertAnimation), [appearance.alertAnimation]);
  useEffect(() => setThermometerAnimation(appearance.thermometerAnimation), [appearance.thermometerAnimation]);
  useEffect(() => setInInput(String(savedInMs)), [savedInMs]);
  useEffect(() => setOutInput(String(savedOutMs)), [savedOutMs]);
  useEffect(() => setColorInputs({ font: savedColors.font, accent: savedColors.accent, background: savedColors.background }), [savedColors.font, savedColors.accent, savedColors.background]);
  useEffect(() => {
    setCustomOptions({ borderWidth: savedCustomTheme.borderWidth, corners: savedCustomTheme.corners, iconEnabled: savedCustomTheme.iconEnabled, icon: savedCustomTheme.icon, fontFamily: savedCustomTheme.fontFamily });
    setBorderInput(String(savedCustomTheme.borderWidth));
  }, [savedCustomTheme.borderWidth, savedCustomTheme.corners, savedCustomTheme.iconEnabled, savedCustomTheme.icon, savedCustomTheme.fontFamily]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const testAnimation = () => {
    timers.current.forEach(clearTimeout);
    setTesting(true);
    setAlertPreviewVisible(true);
    setPreviewCycle((value) => value + 1);
    const visibleMs = animationInMs + settings.alertDurationSeconds * 1000;
    timers.current = [setTimeout(() => setAlertPreviewVisible(false), visibleMs), setTimeout(() => {
      setTesting(false); setAlertPreviewVisible(true);
    }, visibleMs + animationOutMs)];
  };
  const stopAnimation = () => {
    timers.current.forEach(clearTimeout);
    setTesting(false); setAlertPreviewVisible(true);
  };
  // The thermometer enters once and stays. Only the alert exits, then returns
  // to its idle sample immediately without an extra entrance animation.
  const previewTiming = { animationInMs: testing ? animationInMs : 0, animationOutMs: testing ? animationOutMs : 0 };
  const classicColors = {
    font: parseHexColor(colorInputs.font) ?? savedColors.font,
    accent: parseHexColor(colorInputs.accent) ?? savedColors.accent,
    background: parseHexColor(colorInputs.background) ?? savedColors.background,
  };
  const colorsValid = Object.values(colorInputs).every((value) => parseHexColor(value));
  const changed = selected !== appearance.theme || alertAnimation !== appearance.alertAnimation || thermometerAnimation !== appearance.thermometerAnimation ||
    animationInMs !== savedInMs || animationOutMs !== savedOutMs ||
    customTheme.borderWidth !== savedCustomTheme.borderWidth || customTheme.corners !== savedCustomTheme.corners || customTheme.iconEnabled !== savedCustomTheme.iconEnabled || customTheme.icon !== savedCustomTheme.icon || customTheme.fontFamily !== savedCustomTheme.fontFamily ||
    Object.entries(classicColors).some(([key, value]) => value !== savedColors[key as keyof typeof savedColors]);
  const theme = themes.find((item) => item.id === selected)!;
  const sampleIcon = overlayIcon(customTheme);
  const previewCampaign = connected ? campaign : sampleCampaign;
  const showLiveAlert = !testing && alert.visible && alert.donation && (connected || (alert.donation.test && !alert.entryId));
  const previewAlert: DonationAlert = showLiveAlert ? { ...alert, visible: alertPreviewVisible } : {
    donation: { id: 'preview', message: 'Proud to support this community. Keep going!', donorName: 'Your generous donor', amount: 25, currency: previewCampaign.currency, timestamp: '', anonymous: false, test: true }, visible: alertPreviewVisible, queued: 0,
  };
  const alertUrl = graphicUrl('alert');
  const positioningUrl = alertUrl ? `${alertUrl}${alertUrl.includes('?') ? '&' : '?'}test=1` : '';
  return <PanelLayout page="overlays" controls={controls}>
    <div className="appearance-layout">
    <div className="appearance-grid">
      <section className="card headed-card theme-panel">
        <SectionTitle step="01" title="Overlay themes"/>
        <label htmlFor="overlay-theme">Theme<select id="overlay-theme" value={selected} disabled={disabled || testing} onChange={(event) => setSelected(event.target.value as OverlayTheme)}>{themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="theme-art selected-theme-preview" data-theme={selected} style={customThemeStyle(selected, classicColors, customTheme)} role="img" aria-label={`${theme.name} theme sample`}><span className="theme-art-title">{sampleIcon && <DonationIcon name={sampleIcon}/>}Together, we can.</span><span className="theme-art-amount">{theme.name}<span> theme preview</span></span><span className="theme-art-track"><span/></span></div>
        <p className="appearance-description">{theme.description}</p>
        {selected === 'classic' && <><ClassicColorControls value={colorInputs} preview={classicColors} disabled={disabled || testing} onChange={setColorInputs}/><CustomThemeControls value={customTheme} borderInput={borderInput} borderValid={borderValid} disabled={disabled || testing} onChange={setCustomOptions} onBorderChange={setBorderInput}/></>}
        <OverlayIconControls value={customTheme} disabled={disabled || testing} onChange={setCustomOptions}/>
        {selected === 'bwf' && <a className="brand-reference" href="https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/our-brand#identity" target="_blank" rel="noreferrer">BWF brand reference <Icon name="external"/></a>}
      </section>
      <section className="card headed-card animation-panel">
        <div className="section-heading"><h2>Overlay animations</h2><Icon name="play"/></div>
        <div className="two-fields animation-style-fields">
          <div><label htmlFor="thermometer-animation">Thermometer animation<select id="thermometer-animation" value={thermometerAnimation} disabled={disabled || testing} onChange={(event) => setThermometerAnimation(event.target.value as OverlayAnimation)}>{Object.entries(overlayAnimationNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><p className="appearance-description">{animationDescriptions[thermometerAnimation]}</p></div>
          <div><label htmlFor="alert-animation">Donation alert animation<select id="alert-animation" value={alertAnimation} disabled={disabled || testing} onChange={(event) => setAlertAnimation(event.target.value as OverlayAnimation)}>{Object.entries(overlayAnimationNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><p className="appearance-description">{animationDescriptions[alertAnimation]}</p></div>
        </div>
        <div className="two-fields animation-timing-fields">
          <label htmlFor="animation-in-ms">Animation in <span className="unit">ms</span><input id="animation-in-ms" type="number" min="0" max={MAX_ANIMATION_MS} step="1" value={inInput} disabled={disabled || testing} aria-invalid={!inValid} onChange={(event) => setInInput(event.target.value)} onBlur={() => { if (!inValid) notify.error('Enter an animation-in time from 0–10,000 ms, using a whole number.'); }}/></label>
          <label htmlFor="animation-out-ms">Alert animation out <span className="unit">ms</span><input id="animation-out-ms" type="number" min="0" max={MAX_ANIMATION_MS} step="1" value={outInput} disabled={disabled || testing} aria-invalid={!outValid} onChange={(event) => setOutInput(event.target.value)} onBlur={() => { if (!outValid) notify.error('Enter an animation-out time from 0–10,000 ms, using a whole number.'); }}/></label>
        </div>
        <p className="animation-timing-summary"><strong>{((animationInMs + settings.alertDurationSeconds * 1000 + animationOutMs) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} seconds total per alert</strong><span>{animationInMs.toLocaleString()} ms in + {settings.alertDurationSeconds} seconds fully visible + {animationOutMs.toLocaleString()} ms out.</span></p>
        <p className="fine-print">Animation in sets the entry speed for both overlays. Animation out applies only to donation alerts. Higher values animate more slowly; set 0 for an instant transition. Alert duration is set in Alert Settings and excludes animation time.</p>
        <p className="fine-print">The thermometer enters once on load and stays on screen as donations update its total and progress bar. A new thermometer animation plays on its next load. Alert changes apply to the next alert. Reduced-motion preferences use a gentle fade.</p>
        <p className="fine-print">Use Test below to preview the thermometer entering and staying visible, alongside a full alert cycle.</p>
      </section>
    </div>
    <aside className="theme-apply" aria-label="Apply overlay changes"><p>Preview changes here, then apply them to both live overlays.</p><button className="primary" disabled={disabled || testing || !changed || !inValid || !outValid || (selected === 'classic' && (!colorsValid || !borderValid))} onClick={() => void run('saveOverlayAppearance', { theme: selected, alertAnimation, thermometerAnimation, classicColors, customTheme, animationInMs, animationOutMs }, `${theme.name} appearance applied to both overlays.`)}>{busy === 'saveOverlayAppearance' ? 'Applying…' : 'Apply to overlays'}</button></aside>
    </div>
    <section className="card headed-card overlays"><SectionTitle step="02" title="Preview & connect">
      <div className="button-row overlay-test-actions">
        <button className="secondary" disabled={!testing && (!inValid || !outValid)} onClick={testing ? stopAnimation : testAnimation}>{!testing && <Icon name="play"/>}{testing ? 'Stop preview' : 'Test below'}</button>
        <button className="secondary" disabled={disabled} onClick={() => void run('testAlert', undefined, 'Test alert queued for the live overlay. Your fundraising total is unchanged.')}><Icon name="monitor"/>Test on live overlay</button>
      </div>
    </SectionTitle>
      <p className="section-description">Test below previews your current edits here, without sound. Test on live overlay sends a test alert to the HTML overlay using your applied settings and saved sound. Both work without a connected provider; test alerts leave campaign totals and donation history unchanged.</p>
      <div className="overlay-grid">
        <OverlayCard type="thermometer"><div className="mini-thermo"><Thermometer key={previewCycle} campaign={previewCampaign} theme={selected} animation={thermometerAnimation} classicColors={classicColors} customTheme={customTheme} animationInMs={previewTiming.animationInMs}/></div>{!connected && <span className="sample-label">SAMPLE · NOT ON AIR</span>}</OverlayCard>
        <OverlayCard type="alert"><AlertPreview key={previewCycle} alert={previewAlert} theme={selected} animation={alertAnimation} classicColors={classicColors} customTheme={customTheme} {...previewTiming}/>{!showLiveAlert && <span className="sample-label">SAMPLE · NOT ON AIR</span>}</OverlayCard>
      </div>
      <div className="obs-tip"><Icon name="monitor"/><span>In OBS, add a <b>Browser Source</b>, paste its URL, and use the dimensions shown. Keep NodeCG running during your stream.</span></div>
      <div className="overlay-help"><p>Theme and animation changes update the graphics already open in OBS. Alert timing and sound settings live in <strong>Alert Settings</strong>.</p>{positioningUrl && <a className="text-button" href={positioningUrl} target="_blank" rel="noreferrer">Positioning test <Icon name="external"/></a>}</div>
    </section>
    <DemoPlayground controls={controls}/>
  </PanelLayout>;
}
