import { useEffect, useState } from 'react';
import { PanelLayout, SectionTitle, useControls } from './PanelLayout';
import { AlertSoundControls } from './AlertSoundControls';

export function AlertsPanel() {
  const controls = useControls();
  const { settings, disabled, setBusy, run } = controls;
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const number = (value: string) => value.trim() ? Number(value) : NaN;
  return <PanelLayout page="alerts" controls={controls}>
    <div className="control-grid"><section className="card headed-card alerts-controls"><SectionTitle step="01" title="Alert timing"/>
      <form onSubmit={(event) => { event.preventDefault(); void run('saveSettings', { alertDurationSeconds: draft.alertDurationSeconds, pollingIntervalSeconds: draft.pollingIntervalSeconds }, 'Broadcast settings saved.'); }}>
        <div className="two-fields"><label>Alert duration <span className="unit">seconds</span><input type="number" min="2" max="30" required value={draft.alertDurationSeconds} onChange={(event) => setDraft({ ...draft, alertDurationSeconds: number(event.target.value) })}/></label><label>Refresh interval <span className="unit">seconds</span><input type="number" min={draft.provider === 'donordrive' || settings.provider === 'donordrive' ? 15 : 10} max="300" required value={draft.pollingIntervalSeconds} onChange={(event) => setDraft({ ...draft, pollingIntervalSeconds: number(event.target.value) })}/></label></div>
        <button className="secondary" disabled={disabled}>Save settings</button>
      </form>
      <p className="fine-print">Alert duration is the time a donation stays fully visible. Animation in and out are added to this time; set their speed in Your overlays. Changes apply to the next alert.</p>
      <p className="fine-print">Choose manual or automatic delivery in Donation List & Alerts. Test alerts, animation previews, and demo tools are in Your overlays.</p>
    </section>
    <section className="card headed-card sound-card"><SectionTitle step="02" title="Donation sound"/><AlertSoundControls disabled={disabled} onBusyChange={(active) => setBusy(active ? 'sound' : null)}/></section>


    </div>
  </PanelLayout>;
}
