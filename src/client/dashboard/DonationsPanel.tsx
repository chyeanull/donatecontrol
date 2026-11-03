import { useMemo, useRef, useState } from 'react';
import type { DonationEntry } from '../../shared/models';
import { formatCurrency } from '../../shared/format';
import { useReplicant } from '../shared/nodecg';
import { Icon, PanelLayout, useControls } from './PanelLayout';
import './donations.css';

const PAGE_SIZE = 25;
const dateTime = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
type Controls = ReturnType<typeof useControls>;
type Filter = 'all' | 'unsent' | 'sent' | 'queued';

function DonationRow({ entry, controls, queued, onScreen }: {
  entry: DonationEntry; controls: Controls; queued: number; onScreen: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.donorName);
  const [message, setMessage] = useState(entry.message);
  const editButton = useRef<HTMLButtonElement>(null);
  const edited = entry.donorName !== entry.donation.donorName || entry.message !== (entry.donation.message ?? '');
  const { disabled, run } = controls;
  const finishEditing = () => { setEditing(false); requestAnimationFrame(() => editButton.current?.focus()); };
  const startEditing = () => { setName(entry.donorName); setMessage(entry.message); setEditing(true); };
  const status = <div className="donation-send-status" aria-live="polite" aria-atomic="true">
    <strong className={entry.sentCount ? 'donation-sent' : 'donation-unsent'}>Sent {entry.sentCount} {entry.sentCount === 1 ? 'time' : 'times'}</strong>
    {onScreen && <span className="donation-on-screen">On screen</span>}
    {queued > 0 && <span className="donation-queued">Queued{queued > 1 ? ` × ${queued}` : ''}</span>}
    {!onScreen && queued === 0 && entry.lastSentAt && <time dateTime={entry.lastSentAt}>{dateTime(entry.lastSentAt)}</time>}
    {!onScreen && queued === 0 && !entry.sentCount && <span>Not sent</span>}
  </div>;

  return <li className={`donation-entry ${editing ? 'is-editing' : ''}`}>
    <div className="donation-entry-meta"><time dateTime={entry.donation.timestamp}>{dateTime(entry.donation.timestamp)}</time><span>{entry.campaignTitle}</span>{entry.donation.test && <span className="demo-tag">TEST</span>}{edited && <span className="donation-edited" title={entry.editedAt ? `Edited ${dateTime(entry.editedAt)}` : 'Alert text differs from the original donation'}>Edited</span>}</div>
    {editing ? <form className="donation-edit-form" aria-label={`Edit donation from ${entry.donorName}`} onSubmit={async (event) => {
      event.preventDefault();
      const saved = await run('editDonation', { entryId: entry.id, donorName: name, message }, 'Alert text saved. Future sends will use these edits.');
      if (saved) finishEditing();
    }}>
      <fieldset disabled={disabled}>
        <div className="donation-edit-top"><label>Donor name<input autoFocus required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label><div className="donation-edit-amount"><span>Donation amount</span><strong>{formatCurrency(entry.donation.amount, entry.donation.currency)}</strong><small>Original amount is preserved</small></div>{status}</div>
        <label>Donation text<textarea rows={3} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="No message with this donation" /></label>
        <div className="donation-edit-footer"><div className="button-row"><button type="submit" className="primary">{controls.busy === 'editDonation' ? 'Saving…' : 'Save changes'}</button><button type="button" className="secondary" onClick={finishEditing}>Cancel</button></div><button type="button" className="quiet" onClick={() => { setName(entry.donation.donorName); setMessage(entry.donation.message ?? ''); }}>Restore original text</button></div>
        <p className="fine-print">Edits apply to queued and future sends. An alert already on screen finishes with its current text.</p>
      </fieldset>
    </form> : <div className="donation-entry-content">
      <div className="donation-entry-text"><strong className="donation-entry-name">{entry.donorName}</strong>{entry.message ? <p>{entry.message}</p> : <p className="muted">No donation message</p>}</div>
      <strong className="donation-entry-amount">{formatCurrency(entry.donation.amount, entry.donation.currency)}</strong>
      {status}
      <div className="donation-entry-actions"><button type="button" className="primary" disabled={disabled} aria-label={`${entry.sentCount ? 'Send again' : 'Send to screen'}: ${entry.donorName}`} onClick={() => void run('sendDonation', { entryId: entry.id }, `Alert for ${entry.donorName} queued for screen.`)}><Icon name="play"/>{entry.sentCount ? 'Send again' : 'Send to screen'}</button><div className="donation-edit-actions"><button ref={editButton} type="button" className="secondary" disabled={disabled} onClick={startEditing} aria-label={`Edit donation from ${entry.donorName}`}>Edit</button>{edited && <button type="button" className="secondary" disabled={disabled} aria-label={`Reset donation from ${entry.donorName}`} title="Restore the original donor name and donation text" onClick={async () => {
        if (await run('resetDonation', { entryId: entry.id })) requestAnimationFrame(() => editButton.current?.focus());
      }}>{controls.busy === 'resetDonation' ? 'Resetting…' : 'Reset'}</button>}</div></div>
    </div>}
  </li>;
}

export function DonationsPanel() {
  const controls = useControls();
  const { disabled, connected, run } = controls;
  const savedHistory = useReplicant('donationHistory');
  const { campaignKey } = useReplicant('donationLedger');
  const history = useMemo(() => connected ? savedHistory.filter((entry) => entry.campaignKey === campaignKey) : [], [connected, savedHistory, campaignKey]);
  const { manual } = useReplicant('donationControl');
  const alert = useReplicant('currentAlert');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const queued = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of alert.queuedEntryIds ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  }, [alert.queuedEntryIds]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return history.filter((entry) => {
      const matches = filter === 'all' || (filter === 'unsent' && entry.sentCount === 0)
        || (filter === 'sent' && entry.sentCount > 0) || (filter === 'queued' && queued.has(entry.id));
      return matches && (!query || `${entry.donorName} ${entry.message} ${entry.campaignTitle} ${entry.donation.amount}`.toLocaleLowerCase().includes(query));
    }).reverse();
  }, [history, search, filter, queued]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const unsent = history.filter((entry) => entry.sentCount === 0).length;

  return <PanelLayout page="donations" controls={controls}>
    <section className="donation-mode-layout" aria-label="Alert delivery mode">
      <div className="card donation-mode">
        <label className="toggle-row"><strong>Manual alert control</strong><input type="checkbox" role="switch" aria-label="Manual alert control" aria-describedby="manual-alert-description manual-alert-detail" checked={manual} disabled={disabled} onChange={(event) => void run('setManualAlertControl', { manual: event.target.checked }, event.target.checked ? 'Manual control on. New donations will wait for you to send them.' : 'Automatic control on. Future donations will play automatically; held donations stay in the list.')}/></label>
      </div>
      <div className="donation-mode-status">
        <span className="donation-mode-label">{manual ? 'Manual control is on' : 'Manual control is off'}</span>
        <strong id="manual-alert-description">{manual ? 'You choose when each donation alert goes on stream.' : 'New donation alerts go on stream automatically.'}</strong>
        <p id="manual-alert-detail">{!connected && 'Connect a provider on Main to receive donations. '}{manual ? 'Donations wait in the list until you click Send to screen. An alert already on screen will finish.' : 'Previously held donations stay in the list until you send them.'}</p>
      </div>
    </section>
    {connected ? <section className="donation-archive" aria-labelledby="donation-list-heading">
      <div className="donation-table">
      <header className="donation-list-header">
      <div className="donation-archive-heading"><div><h2 id="donation-list-heading">All donations</h2><p>{history.length.toLocaleString()} saved · {unsent.toLocaleString()} not sent</p></div></div>
      <div className="donation-toolbar"><label>Search donations<input type="search" placeholder="Name, message, campaign or amount" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }}/></label><label>Show<select value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setPage(0); }}><option value="all">All donations</option><option value="unsent">Not sent</option><option value="sent">Sent</option><option value="queued">Queued for screen</option></select></label></div>
      </header>
      {visible.length ? <ul className="donation-entries" aria-label="Saved donations">{visible.map((entry) => <DonationRow key={entry.id} entry={entry} controls={controls} queued={queued.get(entry.id) ?? 0} onScreen={alert.visible && alert.entryId === entry.id}/>)}</ul> : <div className="empty-state"><strong>{history.length ? 'No donations match this view.' : 'Your donation list is ready.'}</strong><span>{history.length ? 'Try another search or show all donations.' : 'Donations received from this campaign will be saved here.'}</span>{history.length > 0 && <button className="secondary" onClick={() => { setSearch(''); setFilter('all'); setPage(0); }}>Show all donations</button>}</div>}
      {filtered.length > PAGE_SIZE && <nav className="donation-pagination" aria-label="Donation list pages"><span>Page {currentPage + 1} of {pages} · {filtered.length.toLocaleString()} donations</span><div className="button-row"><button className="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="secondary" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div></nav>}
      </div>
      <p className="fine-print donation-storage-note">Donations, edits and send counts are saved locally and survive restarts. Sent counts include automatic and manual alerts when playback starts; queued alerts are not counted. Counts for older donations start when they are added to this list.</p>
    </section> : <div className="empty-state donation-connect-prompt"><strong>Connect a provider to view donations.</strong><span>Choose a provider and connect on Main. Saved donations will appear for that campaign.</span></div>}
  </PanelLayout>;
}
