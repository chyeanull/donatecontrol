import { type CustomTheme } from '../../shared/models';
import { overlayFonts, type OverlayFont } from '../../shared/fonts';
import { notify } from './notifications';

export function CustomThemeControls({ value, borderInput, borderValid, disabled, onChange, onBorderChange }: {
  value: CustomTheme; borderInput: string; borderValid: boolean; disabled: boolean;
  onChange: (value: CustomTheme) => void; onBorderChange: (value: string) => void;
}) {
  return <fieldset className="custom-theme-controls" disabled={disabled} aria-label="Custom theme settings">
    <label className="custom-font-field" htmlFor="custom-font">Google Font<select id="custom-font" value={value.fontFamily ?? 'Inter'} onChange={(event) => onChange({ ...value, fontFamily: event.target.value as OverlayFont })}>{overlayFonts.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
    <label htmlFor="custom-border-width">Border (px)<input id="custom-border-width" type="number" min="0" max="10" step="1" value={borderInput} aria-invalid={!borderValid}
      onChange={(event) => onBorderChange(event.target.value)} onBlur={() => { if (!borderValid) notify.error('Enter a border size from 0–10 px, using a whole number.'); }}/></label>
    <label htmlFor="custom-corners">Corners<select id="custom-corners" value={value.corners} onChange={(event) => onChange({ ...value, corners: event.target.value as CustomTheme['corners'] })}><option value="rounded">Rounded</option><option value="straight">Straight</option></select></label>
  </fieldset>;
}
