import { notify } from './notifications';
import { useState } from 'react';
import { BUNDLE } from '../../shared/models';
import { useReplicant } from '../shared/nodecg';

export function CredentialForm({ disabled, onBusyChange }: { disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const status = useReplicant('credentialStatus');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);

  const update = async (method: 'POST' | 'DELETE') => {
    setSaving(true); onBusyChange(true);
    try {
      // NodeCG broadcasts messages to other clients. Secrets go only to this
      // authenticated HTTP route, never through sendMessage or a Replicant.
      const response = await fetch(`/${BUNDLE}/credentials`, {
        method, credentials: 'same-origin', redirect: 'error', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-GoFundMe-Control': 'credentials' },
        ...(method === 'POST' ? { body: JSON.stringify({ clientId, clientSecret }) } : {}),
        signal: AbortSignal.timeout(90000),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error : 'Credentials could not be updated. Try again.';
        notify.error(message); return;
      }
      setClientId(''); setClientSecret('');
      notify.success(method === 'POST'
        ? 'Credentials saved. Enter your Pro campaign ID above and click Connect. No restart needed.'
        : 'Saved credentials removed. Server environment credentials will be used if configured. Connect again to continue.');
    } catch {
      notify.error('Could not confirm the credential update. Check your NodeCG connection or sign in again, then check the credential status before retrying.');
    } finally { setSaving(false); onBusyChange(false); }
  };

  return <div className="credential-form">
    <div className="credential-heading"><h3>GoFundMe Pro credentials</h3><span className="subtle-badge">{status.configured ? 'CONFIGURED' : 'NOT CONFIGURED'}</span></div>
    <p className="fine-print">GoFundMe Pro uses a client ID and client secret. Save both here, then connect your campaign.</p>
    <p className={`credential-status ${status.storageError ? 'error-text' : ''}`} role="status">
      {status.storageError ? 'Saved credentials could not be loaded. Replace or remove them below.'
        : status.source === 'dashboard' ? 'Credentials are saved on this server. Enter a new pair below to replace them.'
        : status.source === 'environment' ? 'Using credentials from the server environment. Saving here will override them for this app.'
        : 'No credentials configured yet.'}
    </p>
    <form onSubmit={(event) => { event.preventDefault(); void update('POST'); }} autoComplete="off">
      <fieldset disabled={disabled || saving}>
        <div className="two-fields">
          <label htmlFor="pro-client-id">Client ID<input id="pro-client-id" name="pro-client-id" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={4096} placeholder="Paste your client ID" value={clientId} onChange={(event) => setClientId(event.target.value)}/></label>
          <label htmlFor="pro-client-secret">Client Secret<input id="pro-client-secret" name="pro-client-secret" type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} required maxLength={4096} placeholder="Paste your client secret" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)}/></label>
        </div>
        <div className="button-row"><button className="secondary" type="submit">{saving ? 'Saving…' : 'Save credentials'}</button>{status.saved && <button className="quiet" type="button" onClick={() => void update('DELETE')}>Remove saved credentials</button>}</div>
      </fieldset>
    </form>
    <p className="fine-print">Saved values stay on the server and are never shown again. Replacing credentials disconnects an active Pro campaign until you connect again.</p>
  </div>;
}
