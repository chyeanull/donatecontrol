import { notify } from './notifications';
import { useState } from 'react';
import { BUNDLE } from '../../shared/models';
import { useReplicant } from '../shared/nodecg';

export function GivebutterCredentials({ disabled, onBusyChange }: { disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const status = useReplicant('givebutterCredentialStatus');
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const update = async (method: 'POST' | 'DELETE') => {
    onBusyChange(true); setSaving(true);
    try {
      const response = await fetch(`/${BUNDLE}/givebutter-credentials`, { method, credentials: 'same-origin', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-GoFundMe-Control': 'credentials' },
        ...(method === 'POST' ? { body: JSON.stringify({ apiKey: key }) } : {}), signal: AbortSignal.timeout(90000) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The key could not be updated.');
      setKey(''); notify.success(method === 'POST' ? 'API key saved. Enter your campaign URL or ID/code above and connect.' : 'Saved key removed. The server environment key will be used if configured.');
    } catch (err) { notify.error(err instanceof Error ? err.message : 'Check the NodeCG connection and try again.'); }
    finally { onBusyChange(false); setSaving(false); }
  };
  return <div className="credential-form">
    <div className="credential-heading"><h3>Givebutter API key</h3><span className="subtle-badge">{status.configured ? 'CONFIGURED' : 'NOT CONFIGURED'}</span></div>
    <p className="fine-print">Create a key in Givebutter Settings → Developers → API. <a className="text-button" href="https://docs.givebutter.com/api-reference/authentication" target="_blank" rel="noreferrer">API documentation ↗</a></p>
    <p className="credential-status" role="status">{status.storageError ? 'The saved key could not be loaded. Replace or remove it below.' : status.source === 'dashboard' ? 'Using the key saved on this server.' : status.source === 'environment' ? 'Using the server environment key.' : 'No API key configured yet.'}</p>
    <form autoComplete="off" onSubmit={(event) => { event.preventDefault(); void update('POST'); }}><fieldset disabled={disabled || saving}>
      <label>API key<input type="password" required maxLength={4096} autoComplete="new-password" spellCheck={false} value={key} onChange={(event) => setKey(event.target.value)} placeholder="Paste your Givebutter API key"/></label>
      <div className="button-row credential-result"><button type="submit" className="secondary">{saving ? 'Saving…' : 'Save API key'}</button>{status.saved && <button type="button" className="quiet" onClick={() => void update('DELETE')}>Remove saved key</button>}</div>
    </fieldset></form>
    <p className="fine-print">Keys stay on this server and are never shown again. Replacing a key disconnects an active Givebutter campaign until you connect again.</p>
  </div>;
}
