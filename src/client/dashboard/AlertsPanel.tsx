import { useEffect, useState } from 'react';
import { PanelLayout, SectionTitle, useControls } from './PanelLayout';
import { AlertSoundControls } from './AlertSoundControls';
import { InfoTooltip } from './InfoTooltip';

export function AlertsPanel() {
  const controls = useControls();
  const { settings, disabled, setBusy, run } = controls;
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const number = (value: string) => value.trim() ? Number(value) : NaN;
  const minRefresh = [draft.provider, settings.provider].some((provider) => ['donordrive', 'movember'].includes(provider)) ? 15 : 10;
  return <PanelLayout page="alerts" controls={controls}>
    <div className="control-grid"><section className="card headed-card alerts-controls"><SectionTitle step="01" title="Alert timing"/>
      <form onSubmit={(event) => { event.preventDefault(); void run('saveSettings', { alertDurationSeconds: draft.alertDurationSeconds, pollingIntervalSeconds: draft.pollingIntervalSeconds }, 'Broadcast settings saved.'); }}>
        <div className="two-fields">
          <div><div className="field-label-with-info"><label htmlFor="alert-duration">Alert duration</label><InfoTooltip label="Alert duration" text="How long a donation stays fully visible (2–30 seconds). Entry and exit animations are extra; set them in Your overlays. Changes apply to the next alert."/><span className="unit">seconds</span></div><input id="alert-duration" type="number" min="2" max="30" required value={draft.alertDurationSeconds} onChange={(event) => setDraft({ ...draft, alertDurationSeconds: number(event.target.value) })}/></div>
          <div><div className="field-label-with-info"><label htmlFor="refresh-interval">Refresh interval</label><InfoTooltip label="Refresh interval" text={`How often the app checks for new donations and campaign totals while connected. New items appear after a successful check, plus any provider delay. Choose ${minRefresh}–300 seconds.`}/><span className="unit">seconds</span></div><input id="refresh-interval" type="number" min={minRefresh} max="300" required value={draft.pollingIntervalSeconds} onChange={(event) => setDraft({ ...draft, pollingIntervalSeconds: number(event.target.value) })}/></div>
        </div>
        <button className="secondary" disabled={disabled}>Save settings</button>
      </form>
    </section>
    <section className="card headed-card sound-card"><SectionTitle step="02" title="Donation sound"/><AlertSoundControls disabled={disabled} onBusyChange={(active) => setBusy(active ? 'sound' : null)}/></section>


    </div>
  </PanelLayout>;
}
