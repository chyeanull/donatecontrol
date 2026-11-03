import { donationIconNames, type CustomTheme, type DonationIconName } from '../../shared/models';
import { DonationIcon } from '../shared/DonationIcon';

export function OverlayIconControls({ value, disabled, onChange }: {
  value: CustomTheme; disabled: boolean; onChange: (value: CustomTheme) => void;
}) {
  return <div className="overlay-icon-controls">
    <label className="toggle-row custom-icon-toggle"><span><strong>Show icon</strong></span><input type="checkbox" role="switch" checked={value.iconEnabled} disabled={disabled} onChange={(event) => onChange({ ...value, iconEnabled: event.target.checked })}/></label>
    <fieldset className="custom-icons" disabled={disabled || !value.iconEnabled}>
      <legend>Icon</legend>
      <div className="custom-icon-grid">{Object.entries(donationIconNames).map(([name, label]) => <label className="custom-icon-choice" key={name}>
        <input type="radio" name="custom-icon" value={name} checked={value.icon === name} onChange={() => onChange({ ...value, icon: name as DonationIconName })}/>
        <DonationIcon name={name as DonationIconName}/><span>{label}</span>
      </label>)}</div>
    </fieldset>
    <p className="fine-print">The icon and Show icon setting are shared by every theme and both overlays.</p>
  </div>;
}
