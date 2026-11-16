import { type CustomTheme } from '../../shared/models';
import { DonationIconSelect } from './DonationIconSelect';

export function OverlayIconControls({ value, disabled, onChange }: {
  value: CustomTheme; disabled: boolean; onChange: (value: CustomTheme) => void;
}) {
  return <div className="overlay-icon-controls">
    <label className="toggle-row custom-icon-toggle"><span><strong>Show icon</strong></span><input type="checkbox" role="switch" checked={value.iconEnabled} disabled={disabled} onChange={(event) => onChange({ ...value, iconEnabled: event.target.checked })}/></label>
    <DonationIconSelect value={value.icon} disabled={disabled || !value.iconEnabled} describedBy="overlay-icon-help" onChange={(icon) => onChange({ ...value, icon })}/>
    <p id="overlay-icon-help" className="fine-print">The icon and Show icon setting are shared by every theme and both overlays.</p>
  </div>;
}
