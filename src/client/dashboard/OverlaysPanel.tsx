import { useEffect, useRef, useState } from 'react';
import { Thermometer } from '../shared/Graphics';
import { useReplicant } from '../shared/nodecg';
import { DEFAULT_ANIMATION_IN_MS, DEFAULT_ANIMATION_OUT_MS, MAX_ANIMATION_MS, animationMsSchema, customBorderWidthSchema, defaultClassicColors, emptyCampaign, overlayAnimationNames, overlayThemeNames, type DonationAlert, type OverlayTheme, type OverlayAnimation } from '../../shared/models';
import { parseHexColor, resolveOverlayAppearance, resolveAlertPlayback } from '../../shared/appearance';
import { customThemeStyle, overlayIcon } from '../shared/appearance';
import { DonationIcon } from '../shared/DonationIcon';
import { CounterStrikeChicken } from '../shared/CounterStrikeChicken';
import { MustacheRiderThermometer } from '../shared/MustacheRiderThermometer';
import { PanelLayout, SectionTitle, Icon, useControls } from './PanelLayout';
import { OverlayCard } from './OverlayCard';
import { AlertPreview } from './AlertPreview';
import { DemoPlayground } from './DemoPlayground';
import { ClassicColorControls } from './ClassicColorControls';
import { CustomThemeControls } from './CustomThemeControls';
import { OverlayIconControls } from './OverlayIconControls';
import { notify } from './notifications';
import { InfoTooltip } from './InfoTooltip';

const themes = [
  { id: 'classic', name: 'Custom', description: null },
  { id: 'quest', name: 'Quest', description: 'Parchment lettering, antique gold, and an ornate frame for your campaign.' },
  { id: 'bwf', name: 'BWF', description: 'Foundation green, warm tan, and Source Sans Pro, drawn from the BWF brand guide.' },
  { id: 'cyberpunk', name: overlayThemeNames.cyberpunk, description: 'Electric yellow, cyan details, and angular frames inspired by Night City.' },
  { id: 'gta6', name: overlayThemeNames.gta6, description: 'Sunset pink, warm cream, and bold lettering inspired by Vice City.' },
  { id: 'cs2', name: overlayThemeNames.cs2, description: 'Charcoal, Counter-Strike orange, and a familiar chicken beside every donation.' },
  { id: 'mustacherider', name: overlayThemeNames.mustacherider, description: 'A hot dog thermometer with mustard that grows as donations come in.' },
] as const;
const animationDescriptions: Record<OverlayAnimation, string> = {
  'draw-left': 'The frame draws from left to right, followed by the title, amounts, and progress bar.',
  'rise-fade': 'The overlay lifts gently into place, with its details fading in one after another.',
  'soft-zoom': 'The overlay softly scales into view, followed by a subtle reveal of each detail.',
  'slide-right': 'The overlay glides in from the right edge and eases into place as its details fade in.',
  'center-reveal': 'The frame opens outward from the center like a curtain, revealing the text without moving it.',
};
const sampleCampaign = { ...emptyCampaign, title: 'Together, we can.', raised: 12500, goal: 25000, percent: 50 };

export function OverlaysPanel() {
  const controls = useControls();
  const { connected, disabled, busy, run, settings } = controls;
  const appearance = resolveOverlayAppearance(useReplicant('overlayAppearance'));
  const campaign = useReplicant('campaign');
  const alert = useReplicant('currentAlert');
  const [selected, setSelected] = useState<OverlayTheme>(appearance.theme);
  const customMotion = selected === 'mustacherider';
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
  const previewPlayback = resolveAlertPlayback({ ...appearance, theme: selected, alertAnimation, animationInMs, animationOutMs }, settings.alertDurationSeconds);
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
    const visibleMs = previewPlayback.animationInMs + previewPlayback.holdMs;
    timers.current = [setTimeout(() => setAlertPreviewVisible(false), visibleMs), setTimeout(() => {
      setTesting(false); setAlertPreviewVisible(true);
    }, visibleMs + previewPlayback.animationOutMs)];
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
  return <PanelLayout page="overlays" controls={controls}>
    <div className="appearance-layout">
    <div className="appearance-grid">
      <section className="card headed-card theme-panel">
        <SectionTitle step="01" title="Overlay themes"/>
        <label htmlFor="overlay-theme">Theme<select id="overlay-theme" value={selected} disabled={disabled || testing} onChange={(event) => setSelected(event.target.value as OverlayTheme)}>{themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="theme-art selected-theme-preview" data-theme={selected} style={customThemeStyle(selected, classicColors, customTheme)} role="img" aria-label={`${theme.name} theme sample`}>{selected === 'mustacherider' ? <MustacheRiderThermometer campaign={previewCampaign}/> : <>{selected === 'cs2' && <CounterStrikeChicken/>}<span className="theme-art-title">{sampleIcon && <DonationIcon name={sampleIcon}/>}Together, we can.</span><span className="theme-art-amount">{theme.name}<span> theme preview</span></span><span className="theme-art-track"><span/></span></>}</div>
        {theme.description && <p className="appearance-description">{theme.description}</p>}
        {selected === 'classic' && <><ClassicColorControls value={colorInputs} preview={classicColors} disabled={disabled || testing} onChange={setColorInputs}/><CustomThemeControls value={customTheme} borderInput={borderInput} borderValid={borderValid} disabled={disabled || testing} onChange={setCustomOptions} onBorderChange={setBorderInput}/></>}
        {!customMotion && <OverlayIconControls value={customTheme} disabled={disabled || testing} onChange={setCustomOptions}/>}
        {selected === 'bwf' && <a className="brand-reference" href="https://brandguides.dam.gettyimages.com/bob-woodruff-foundation-brandguide/our-brand#identity" target="_blank" rel="noreferrer">BWF brand reference <Icon name="external"/></a>}
      </section>
      <section className="card headed-card animation-panel">
        <div className="section-heading"><h2>Overlay animations</h2><Icon name="play"/></div>
        <div className="two-fields animation-style-fields">
          <div><label htmlFor="thermometer-animation">Thermometer animation<select id="thermometer-animation" value={customMotion ? 'mustacherider' : thermometerAnimation} disabled={disabled || testing || customMotion} onChange={(event) => setThermometerAnimation(event.target.value as OverlayAnimation)}>{customMotion && <option value="mustacherider">Hot dog & mustard</option>}{Object.entries(overlayAnimationNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><p className="appearance-description">{customMotion ? 'The hot dog rises with a little jiggle, then the mustard draws from left to right.' : animationDescriptions[thermometerAnimation]}</p></div>
          <div><label htmlFor="alert-animation">Donation alert animation<select id="alert-animation" value={customMotion ? 'mustacherider' : alertAnimation} disabled={disabled || testing || customMotion} onChange={(event) => setAlertAnimation(event.target.value as OverlayAnimation)}>{customMotion && <option value="mustacherider">Receipt printer</option>}{Object.entries(overlayAnimationNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><p className="appearance-description">{customMotion ? 'The receipt prints sideways, tears free, turns upright, pauses for reading, then floats off the bottom. Long messages stay longer and scroll slowly.' : animationDescriptions[alertAnimation]}</p></div>
        </div>
        <div className="two-fields animation-timing-fields">
          <div><div className="field-label-with-info"><label htmlFor="animation-in-ms">Animation in</label><InfoTooltip label="Animation in" text={customMotion ? 'MustacheRider uses fixed custom sequences: a 2.7-second hot dog entrance, and a 1.5-second cha-ching lead-in before the 3.6-second receipt printing, tear-off, and turn.' : "Entry time for both overlays, added before the alert's fully visible duration. Higher values are slower; 0 is instant. The thermometer enters once on load, then stays visible."}/><span className="unit">ms</span></div><input id="animation-in-ms" type="number" min="0" max={MAX_ANIMATION_MS} step="1" value={customMotion ? previewPlayback.animationInMs : inInput} disabled={disabled || testing || customMotion} aria-invalid={!customMotion && !inValid} onChange={(event) => setInInput(event.target.value)} onBlur={() => { if (!inValid) notify.error('Enter an animation-in time from 0–10,000 ms, using a whole number.'); }}/></div>
          <div><div className="field-label-with-info"><label htmlFor="animation-out-ms">Alert animation out</label><InfoTooltip label="Alert animation out" text={customMotion ? 'MustacheRider receipts float off the bottom in 1.4 seconds after the message reading time ends.' : 'Time a donation alert takes to leave, added after its fully visible duration. Higher values are slower; 0 is instant. Changes apply to the next alert. The thermometer does not animate out.'}/><span className="unit">ms</span></div><input id="animation-out-ms" type="number" min="0" max={MAX_ANIMATION_MS} step="1" value={customMotion ? previewPlayback.animationOutMs : outInput} disabled={disabled || testing || customMotion} aria-invalid={!customMotion && !outValid} onChange={(event) => setOutInput(event.target.value)} onBlur={() => { if (!outValid) notify.error('Enter an animation-out time from 0–10,000 ms, using a whole number.'); }}/></div>
        </div>
        <p className="animation-timing-summary"><strong>{customMotion ? 'From ' : ''}{((previewPlayback.animationInMs + previewPlayback.holdMs + previewPlayback.animationOutMs) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} seconds total per alert</strong><span>{previewPlayback.animationInMs.toLocaleString()} ms in + {previewPlayback.holdMs / 1000} seconds {customMotion ? 'minimum ' : ''}fully visible + {previewPlayback.animationOutMs.toLocaleString()} ms out.</span></p>
        <p className="fine-print">{customMotion ? 'MustacheRider uses its own animations and timing. Your other animation settings are kept for the other themes.' : 'Use Test below to preview the thermometer entering and staying visible, alongside a full alert cycle.'}</p>
      </section>
    </div>
    <aside className="theme-apply" aria-label="Save overlay changes"><p>Preview changes here, then apply them to both live overlays.</p><button className="primary" disabled={disabled || (controls.sendLocked && !customMotion) || testing || !changed || (!customMotion && (!inValid || !outValid)) || (selected === 'classic' && (!colorsValid || !borderValid))} onClick={() => void run('saveOverlayAppearance', { theme: selected, alertAnimation, thermometerAnimation, classicColors, customTheme, animationInMs, animationOutMs }, `${theme.name} appearance saved to both overlays.`)}>{busy === 'saveOverlayAppearance' ? 'Saving…' : 'Save Changes'}</button></aside>
    </div>
    <section className="card headed-card overlays"><SectionTitle step="02" title="Preview & connect">
      <div className="button-row overlay-test-actions">
        <button className="secondary" disabled={!testing && !customMotion && (!inValid || !outValid)} onClick={testing ? stopAnimation : testAnimation}>{!testing && <Icon name="play"/>}{testing ? 'Stop preview' : 'Test below'}</button>
        <button className="secondary" disabled={disabled || controls.sendLocked} onClick={() => void run('testAlert', undefined, 'Test alert queued for the live overlay. Your fundraising total is unchanged.')}><Icon name="monitor"/>Test on live overlay</button>
      </div>
    </SectionTitle>
      <div className="overlay-grid">
        <OverlayCard type="thermometer" thermometerHeight={selected === 'mustacherider' ? 360 : 180}><div className="mini-thermo" data-theme={selected}><Thermometer key={previewCycle} campaign={previewCampaign} theme={selected} animation={thermometerAnimation} classicColors={classicColors} customTheme={customTheme} animationInMs={previewTiming.animationInMs} animateEntrance={testing}/></div>{!connected && <span className="sample-label">SAMPLE · NOT ON AIR</span>}</OverlayCard>
        <OverlayCard type="alert" fullHdAlert={customMotion}><AlertPreview key={previewCycle} alert={previewAlert} theme={selected} animation={alertAnimation} classicColors={classicColors} customTheme={customTheme} animate={testing} {...previewTiming}/>{!showLiveAlert && <span className="sample-label">SAMPLE · NOT ON AIR</span>}</OverlayCard>
      </div>
      <div className="obs-tip"><Icon name="monitor"/><span>In OBS, add a <b>Browser Source</b>, paste its URL, and use the dimensions shown. Keep NodeCG running during your stream.</span></div>
    </section>
    <DemoPlayground controls={controls}/>
  </PanelLayout>;
}
