import { useEffect, useState } from 'react';
import { useReplicant } from '../shared/nodecg';
import { clockTime, formatCurrency } from '../../shared/format';
import type { SettingsState } from '../../shared/models';
import { providerNames } from '../../shared/models';
import { PanelLayout, Icon, SectionTitle, useControls } from './PanelLayout';
import { CredentialForm } from './CredentialForm';
import { GivebutterCredentials } from './GivebutterCredentials';
import { CampaignHistory } from './CampaignHistory';
import { MovemberGoal } from './MovemberGoal';
import { notify } from './notifications';

export function MainPanel() {
  const controls = useControls();
  const { status, settings, online, connected, disabled, busy, setBusy, run } = controls;
  const campaign = useReplicant('campaign');
  const events = useReplicant('eventLog');
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const switchingProvider = status.state !== 'disconnected' && draft.provider !== status.provider;
  const connectionSubtitle = !online ? 'Server offline · connection unavailable'
    : connected ? `Connected to ${providerNames[status.provider]}`
    : status.state === 'connecting' ? `Connecting to ${providerNames[status.provider]}…`
    : status.state === 'error' ? `${providerNames[status.provider]} · connection error`
    : 'Disconnected · no provider connected';
  return <PanelLayout page="main" controls={controls}>
    <div className={`campaign-grid${connected ? ' is-connected' : ''}`}>
    <section className="connection card headed-card">
      <div className="section-heading connection-header">
        <span className="step">01</span><div className="connection-heading"><h2>Campaign connection</h2><p><span aria-hidden="true" className={`status-dot ${online && connected ? 'connected' : 'error'}`}/>{connectionSubtitle}</p></div>
      </div>
      <div id="campaign-connection-fields">
      <form onSubmit={(event) => { event.preventDefault(); void run('connect', draft); }}>
        <div className="connection-fields"><label>Provider<select value={draft.provider} disabled={disabled} onChange={(event) => {
          const provider = event.target.value as SettingsState['provider'];
          setDraft({ ...draft, provider, campaignUrl: provider === settings.provider ? settings.campaignUrl : '',
            campaignId: provider === settings.provider ? settings.campaignId : '',
            pollingIntervalSeconds: ['donordrive', 'movember'].includes(provider) ? Math.max(15, draft.pollingIntervalSeconds) : draft.pollingIntervalSeconds });
        }}>{Object.entries(providerNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="url-field">{draft.provider === 'movember' ? 'Movember Mo Space / feed URL' : draft.provider === 'donordrive' ? 'DonorDrive page or site URL' : draft.provider === 'givebutter' ? 'Givebutter campaign URL' : 'GoFundMe campaign URL'}{draft.provider === 'mock' && <span className="optional">optional in demo</span>}<input type="url" required={draft.provider === 'donordrive'} placeholder={draft.provider === 'movember' ? 'https://movember.com/mospace/12345678' : draft.provider === 'donordrive' ? 'https://your-charity.donordrive.com/…' : draft.provider === 'givebutter' ? 'https://givebutter.com/your-campaign' : 'https://…'} value={draft.campaignUrl} onChange={(event) => setDraft({ ...draft, campaignUrl: event.target.value })}/></label>
          {draft.provider === 'gofundme-pro' && <label>Pro campaign ID<input required inputMode="numeric" pattern="[0-9]+" placeholder="227362" value={draft.campaignId} onChange={(event) => setDraft({ ...draft, campaignId: event.target.value })}/></label>}
          {draft.provider === 'givebutter' && <label>Campaign ID / code<input maxLength={40} placeholder="Optional if URL is entered" value={draft.campaignId} onChange={(event) => setDraft({ ...draft, campaignId: event.target.value })}/></label>}
          {draft.provider === 'movember' && <label>Member ID<input inputMode="numeric" pattern="[0-9]+" maxLength={40} required={!draft.campaignUrl.trim()} placeholder="Optional if included in URL" value={draft.campaignId} onChange={(event) => setDraft({ ...draft, campaignId: event.target.value })}/></label>}
        </div>
        {draft.provider === 'donordrive' && <div className="two-fields donordrive-fields"><label>Fundraiser type<select value={draft.donorDriveResource} onChange={(event) => setDraft({ ...draft, donorDriveResource: event.target.value as SettingsState['donorDriveResource'], campaignId: '' })}><option value="participants">Participant / Personal campaign</option><option value="teams">Team</option><option value="events">Event</option></select></label><label>{draft.donorDriveResource === 'teams' ? 'Team' : draft.donorDriveResource === 'events' ? 'Event' : 'Participant'} ID <span className="optional">optional if in URL</span><input inputMode="numeric" pattern="[0-9]+" placeholder="Numeric ID from your fundraising page" value={draft.campaignId} onChange={(event) => setDraft({ ...draft, campaignId: event.target.value })}/></label></div>}
        {switchingProvider && <div className="provider-warning" role="alert"><p>Disconnect {providerNames[status.provider]} before switching to {providerNames[draft.provider]}. Your current provider remains active until you disconnect.</p><button type="button" className="secondary" disabled={disabled} onClick={() => void run('disconnect', undefined, `Disconnected. You can now connect to ${providerNames[draft.provider]}.`)}>Disconnect {providerNames[status.provider]}</button></div>}
        <div className="connection-bottom"><p>{draft.provider === 'mock' ? 'Try the complete broadcast experience. No account or real donations needed.' : draft.provider === 'movember' ? 'No API key needed. Paste a personal Mo Space or member donation-feed URL, or enter the member ID. Imports public donations from the current fundraising year. Team and network pages are not supported yet.' : draft.provider === 'givebutter' ? 'Save your Givebutter API key below, then enter a campaign URL or ID/code. New public donations will update your graphics and alerts.' : draft.provider === 'donordrive' ? 'No API key needed. Choose a participant, team, or event and paste its public DonorDrive URL. Add the numeric ID if the URL uses a custom alias. Refreshes run at least 15 seconds apart.' : 'Requires GoFundMe Pro / Classy organization API access and a numeric campaign ID. Ordinary GoFundMe URLs are not supported. Add your credentials below.'}</p><div className="button-row"><button type="submit" className="primary" disabled={disabled || switchingProvider}>{busy === 'connect' ? 'Connecting…' : 'Connect'}</button><button type="button" className="secondary" disabled={disabled || status.state === 'disconnected'} onClick={() => void run('refresh', undefined)}><Icon name="refresh"/>Refresh Now</button><button type="button" className="quiet" disabled={disabled || status.state === 'disconnected'} onClick={() => void run('disconnect', undefined)}>Disconnect</button></div></div>
      </form>
      {draft.provider === 'gofundme-pro' && <CredentialForm disabled={disabled} onBusyChange={(active) => setBusy(active ? 'credentials' : null)}/>}
      {draft.provider === 'givebutter' && <GivebutterCredentials disabled={disabled} onBusyChange={(active) => setBusy(active ? 'credentials' : null)}/>}
      </div>
    </section>

    {!connected && status.state !== 'connecting' && busy !== 'connect' && <CampaignHistory disabled={disabled} onSelect={(entry) => {
      setDraft((current) => ({ ...current, provider: entry.provider, campaignUrl: entry.campaignUrl, campaignId: entry.campaignId,
        donorDriveResource: entry.donorDriveResource ?? 'participants',
        pollingIntervalSeconds: ['donordrive', 'movember'].includes(entry.provider) ? Math.max(15, current.pollingIntervalSeconds) : current.pollingIntervalSeconds }));
      notify.success(`${entry.title} loaded. Click Connect when you're ready.`);
    }}/>}

    {connected && <section className="campaign-summary card"><span className="campaign-details-tag">connected campaign details</span><div className="summary-top"><div><h2>{campaign.title}</h2></div><span className="subtle-badge">{status.provider === 'mock' ? 'DEMO CAMPAIGN' : providerNames[status.provider].toUpperCase()}</span></div>
      <div className="stats"><div className="stat main-stat"><span>Total raised</span><strong>{formatCurrency(campaign.raised, campaign.currency)}</strong></div>{status.provider === 'movember' ? <MovemberGoal key={`${campaign.id}:${campaign.currency}`} campaign={campaign} controls={controls}/> : <div className="stat"><span>Fundraising goal</span><strong>{campaign.goal > 0 ? formatCurrency(campaign.goal, campaign.currency, false) : 'Not set'}</strong></div>}<div className="stat"><span>Goal reached</span><strong>{campaign.goal > 0 ? `${campaign.percent.toFixed(campaign.percent % 1 ? 1 : 0)}%` : '—'}</strong></div><div className="stat"><span>Donations</span><strong>{campaign.donationCount?.toLocaleString() ?? '—'}</strong></div></div>
      <div className="summary-track"><span style={{ transform: `scaleX(${Math.min(1, campaign.percent / 100)})` }}/></div>
      <div className="summary-footer"><span><span className={`status-dot ${status.state}`}/>{status.message}</span><span>Last refresh <b>{clockTime(status.lastSuccessfulFetch)}</b></span></div>
      {status.nextRetryAt && <div className="retry-info">Automatic retry after {clockTime(status.nextRetryAt)}.</div>}
    </section>}

    </div>
    {connected && <div className="main-events">      <section className="card headed-card event-log"><SectionTitle step="02" title="Event log"><Icon name="activity"/></SectionTitle><div className="log-list" role="log" aria-live="polite">{events.length ? events.map((event) => <div className={`log-row ${event.level}`} key={event.id}><time>{clockTime(event.timestamp)}</time><span className="log-dot"/><span>{event.message}</span></div>) : <p className="muted">Waiting for the server…</p>}</div></section></div>}
  </PanelLayout>;
}
