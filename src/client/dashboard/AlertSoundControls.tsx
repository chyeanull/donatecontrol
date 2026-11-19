import { notify } from './notifications';
import { useEffect, useState } from 'react';
import { BUNDLE } from '../../shared/models';
import { send, useReplicant } from '../shared/nodecg';
import { SoundPreview } from './SoundPreview';

export function AlertSoundControls({ disabled, onBusyChange }: { disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const sound = useReplicant('alertSound');
  const receiptSound = useReplicant('overlayAppearance').theme === 'mustacherider';
  const [volume, setVolume] = useState(sound.volume);
  const [enabled, setEnabled] = useState(sound.enabled);
  useEffect(() => { setVolume(sound.volume); setEnabled(sound.enabled); }, [sound.volume, sound.enabled]);
  const update = async (action: () => Promise<void>, success: string) => {
    onBusyChange(true);
    try { await action(); notify.success(success); }
    catch (err) { notify.error(err instanceof Error ? err.message : 'The sound could not be updated.'); }
    finally { onBusyChange(false); }
  };
  const upload = async (file?: File) => {
    if (!file || receiptSound) return;
    await update(async () => {
      if (!/\.(mp3|wav|ogg)$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose an MP3, WAV, or OGG file up to 10 MB.');
      const response = await fetch(`/${BUNDLE}/alert-sound`, { method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { 'Content-Type': 'application/octet-stream', 'X-GoFundMe-Control': 'sound', 'X-File-Name': encodeURIComponent(file.name) }, body: file,
        signal: AbortSignal.timeout(90000) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Sound upload failed.');
    }, 'Sound uploaded and enabled for donation alerts.');
  };
  return <div className="sound-controls">
    <h3>{receiptSound ? 'MustacheRider sounds' : 'Donation alert sound'}</h3><p className="fine-print">{receiptSound ? 'Built-in cha-ching, printing, and paper-rip sounds follow the receipt animation. Set volume to 0 to mute.' : 'Plays once per donation, including tests and resends. Long sounds stop when the alert closes.'}</p>
    <label className="sound-upload">{sound.file ? 'Replace sound file' : 'Upload sound file'}<input type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" disabled={disabled || receiptSound} title={receiptSound ? 'MustacheRider uses its built-in receipt sounds.' : undefined} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }}/></label>
    <p className="sound-filename">{receiptSound ? 'Sound uploads are available for other themes. Your saved file is retained.' : <>{sound.file ? sound.name : 'No sound uploaded'} <span className="optional-inline">MP3, WAV, OGG · up to 10 MB</span></>}</p>
    <form onSubmit={(event) => { event.preventDefault(); void update(() => send('saveAlertSound', { enabled, volume }), 'Sound settings saved.'); }}>
      <fieldset disabled={disabled || (!sound.file && !receiptSound)}>
        {!receiptSound && <label className="toggle-row"><span><strong>Play alert sound</strong></span><input type="checkbox" role="switch" checked={enabled} onChange={(event) => setEnabled(event.target.checked)}/></label>}
        <label>Volume · {Math.round(volume * 100)}%<input type="range" min="0" max="100" step="1" value={Math.round(volume * 100)} onChange={(event) => setVolume(Number(event.target.value) / 100)}/></label>
        <div className="button-row credential-result"><button type="submit" className="secondary">Save sound settings</button><SoundPreview receipt={receiptSound} disabled={disabled} volume={volume} label="Test alert sound" stopLabel="Stop sound test"/>{!receiptSound && <button type="button" className="quiet" onClick={() => void update(async () => {
          const response = await fetch(`/${BUNDLE}/alert-sound`, { method: 'DELETE', credentials: 'same-origin', redirect: 'error', headers: { 'X-GoFundMe-Control': 'sound' }, signal: AbortSignal.timeout(90000) });
          if (!response.ok) throw new Error('Sound could not be removed. Try again.');
        }, 'Alert sound removed.')}>Remove sound</button>}</div>
      </fieldset>
    </form>
    <p className="fine-print">Test alert sound plays in this browser at the volume above. Save sound settings to apply changes to your stream. In OBS, enable “Control audio via OBS” on the Donation Alerts Browser Source and adjust its mixer channel.</p>
  </div>;
}
