import type { ClassicColors } from '../../shared/models';
import { parseHexColor } from '../../shared/appearance';
import { notify } from './notifications';

const fields = [
  { key: 'font', label: 'Font color' },
  { key: 'accent', label: 'Accent color' },
  { key: 'background', label: 'Background color' },
] as const;

export function ClassicColorControls({ value, preview, disabled, onChange }: {
  value: ClassicColors; preview: ClassicColors; disabled: boolean; onChange: (value: ClassicColors) => void;
}) {
  return <fieldset className="classic-colors" disabled={disabled}>
    <legend>Colors</legend>
    <div className="classic-color-grid">{fields.map(({ key, label }) => <div className="classic-color-field" key={key}>
      <label htmlFor={`classic-${key}-hex`}>{label}</label>
      <div className="color-input-pair">
        <input type="color" aria-label={`${label} picker`} value={preview[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })}/>
        <input id={`classic-${key}-hex`} aria-label={`${label} hex`} type="text" value={value[key]} spellCheck={false} autoComplete="off" aria-invalid={!parseHexColor(value[key])}
          onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          onBlur={() => {
            const color = parseHexColor(value[key]);
            if (color) onChange({ ...value, [key]: color });
            else notify.error(`Enter a six-digit hex value for ${label.toLowerCase()}, such as #B5F36D.`);
          }}/>
      </div>
    </div>)}</div>
  </fieldset>;
}
