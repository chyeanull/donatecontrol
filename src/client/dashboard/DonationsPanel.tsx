import { useEffect, useMemo, useRef, useState } from 'react';
import type { DonationEntry } from '../../shared/models';
import { formatCurrency } from '../../shared/format';
import { useReplicant } from '../shared/nodecg';
import { Icon, PanelLayout, useControls } from './PanelLayout';
import './donations.css';

const PAGE_SIZE = 25;
const dateTime = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
type Controls = ReturnType<typeof useControls>;
type Filter = 'all' | 'unsent';

function DonationRow({ entry, number, controls, mustacheRider }: {
  entry: DonationEntry; number: number; controls: Controls; mustacheRider: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.donorName);
  const [message, setMessage] = useState(entry.message);
  const editButton = useRef<HTMLButtonElement>(null);
  const edited = entry.donorName !== entry.donation.donorName || entry.message !== (entry.donation.message ?? '');
  const { disabled, run, currentAlert, sendLocked } = controls;
  const fading = sendLocked && currentAlert.entryId === entry.id;
  useEffect(() => { if (fading) setEditing(false); }, [fading]);
  const finishEditing = () => { setEditing(false); requestAnimationFrame(() => editButton.current?.focus()); };
  const startEditing = () => { setName(entry.donorName); setMessage(entry.message); setEditing(true); };
  const donatedAt = new Date(entry.donation.timestamp);
  const badges = <>{entry.donation.test && <span className="demo-tag">TEST</span>}{edited && <span className="donation-edited" title={entry.editedAt ? `Edited ${dateTime(entry.editedAt)}` : 'Alert text differs from the original donation'}>Edited</span>}</>;
  const status = <div className="donation-send-status" aria-live="polite" aria-atomic="true">
    <strong className={entry.sentCount ? 'donation-sent' : 'donation-unsent'}>Sent {entry.sentCount} {entry.sentCount === 1 ? 'time' : 'times'}</strong>
  </div>;

  return <li className={`donation-entry ${editing ? 'is-editing' : ''}`}>
    <span className="donation-entry-number" aria-label={`Donation ${number}`}>{number}</span>
    <time className="donation-entry-timestamp" dateTime={entry.donation.timestamp} title={dateTime(entry.donation.timestamp)}><span>{donatedAt.toLocaleDateString(undefined, { dateStyle: 'medium' })}</span><span>{donatedAt.toLocaleTimeString(undefined, { timeStyle: 'short' })}</span></time>
    {editing ? <form className="donation-edit-form" aria-label={`Edit donation from ${entry.donorName}`} onSubmit={async (event) => {
      event.preventDefault();
      const saved = await run('editDonation', { entryId: entry.id, donorName: name, message }, 'Alert text saved. Future sends will use these edits.');
      if (saved) finishEditing();
    }}>
      <fieldset disabled={disabled}>
        {(entry.donation.test || edited) && <div className="donation-edit-badges">{badges}</div>}
        <div className="donation-edit-top"><label>Donor name<input autoFocus required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label><div className="donation-edit-amount"><span>Donation amount</span><strong>{formatCurrency(entry.donation.amount, entry.donation.currency)}</strong><small>Original amount is preserved</small></div>{status}</div>
        <label>Donation text<textarea rows={3} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="No message with this donation" /></label>
        <div className="donation-edit-footer"><div className="button-row"><button type="submit" className="primary">{controls.busy === 'editDonation' ? 'Saving…' : 'Save changes'}</button><button type="button" className="secondary" onClick={finishEditing}>Cancel</button></div><button type="button" className="quiet" onClick={() => { setName(entry.donation.donorName); setMessage(entry.donation.message ?? ''); }}>Restore original text</button></div>
        <p className="fine-print">Edits apply to queued and future sends. An alert already on screen finishes with its current text.</p>
      </fieldset>
    </form> : <div className="donation-entry-content">
      <div className="donation-entry-text"><div className="donation-entry-heading"><strong className="donation-entry-name">{entry.donorName}</strong>{badges}</div>{entry.message ? <p>{entry.message}</p> : <p className="muted">No donation message</p>}</div>
      <div className="donation-entry-summary"><strong className="donation-entry-amount">{formatCurrency(entry.donation.amount, entry.donation.currency)}</strong>{status}</div>
      <div className="donation-entry-actions"><div className="donation-send-actions"><button type="button" className="primary" disabled={disabled || sendLocked} aria-label={`${entry.sentCount ? 'Send again' : 'Send to screen'}: ${entry.donorName}`} onClick={() => void run('sendDonation', { entryId: entry.id }, `Alert for ${entry.donorName} queued for screen.`)}><Icon name="play"/>{entry.sentCount ? 'Send again' : 'Send to screen'}</button>
      {mustacheRider && <button type="button" className="primary donation-fade" disabled={disabled || (fading ? !currentAlert.visible : Boolean(currentAlert.donation))} aria-label={`${fading ? 'Fade out' : 'Send with fade'}: ${entry.donorName}`} onClick={() => {
        if (fading && currentAlert.donation) void run('fadeOutReceipt', { entryId: entry.id, playbackId: currentAlert.donation.id });
        else void run('sendDonationWithFade', { entryId: entry.id });
      }}>{fading ? 'Fade out' : 'Send with fade'}</button>}</div>
      <div className="donation-edit-actions"><button ref={editButton} type="button" className="secondary" disabled={disabled || fading} onClick={startEditing} aria-label={`Edit donation from ${entry.donorName}`}>Edit</button>{edited && <button type="button" className="secondary" disabled={disabled || fading} aria-label={`Reset donation from ${entry.donorName}`} title="Restore the original donor name and donation text" onClick={async () => {
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
  // Archive order is arrival order; assign labels before filtering or reversing the list.
  const donationNumbers = useMemo(() => new Map(history.map((entry, index) => [entry.id, index + 1])), [history]);
  const { manual } = useReplicant('donationControl');
  const mustacheRider = useReplicant('overlayAppearance').theme === 'mustacherider';
  const { thermometerVisible } = useReplicant('mustacheRiderControls');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return history.filter((entry) => {
      const matches = filter === 'all' || entry.sentCount === 0;
      return matches && (!query || `${entry.donorName} ${entry.message} ${entry.campaignTitle} ${entry.donation.amount}`.toLocaleLowerCase().includes(query));
    }).reverse();
  }, [history, search, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  // Keep the stop control reachable even when sending removes a row from Not sent.
  const held = controls.sendLocked ? history.find((entry) => entry.id === controls.currentAlert.entryId) : undefined;
  if (held && !visible.some((entry) => entry.id === held.id)) visible.unshift(held);
  const unsent = history.filter((entry) => entry.sentCount === 0).length;
  useEffect(() => {
    if (unsent === 0 && filter === 'unsent') {
      setFilter('all');
      setPage(0);
    }
  }, [unsent, filter]);

  return <PanelLayout page="donations" controls={controls}>
    <div className={mustacheRider ? 'donation-top-controls' : undefined}>
    <section className="donation-mode-layout" data-manual={manual} aria-label="Alert delivery mode">
      <div className="card donation-mode">
        <label className="toggle-row"><strong>Manual alert control</strong><input type="checkbox" role="switch" aria-label="Manual alert control" aria-describedby="manual-alert-description manual-alert-detail" checked={manual} disabled={disabled} onChange={(event) => void run('setManualAlertControl', { manual: event.target.checked }, event.target.checked ? 'Manual control on. New donations will wait for you to send them.' : 'Automatic control on. Future donations will play automatically; held donations stay in the list.')}/></label>
      </div>
      <div className="donation-mode-status">
        <span className="donation-mode-label">Manual control is <span className="donation-mode-value">{manual ? 'on' : 'off'}</span></span>
        <strong id="manual-alert-description">{manual ? 'You choose when each donation alert goes on stream.' : 'New donation alerts go on stream automatically.'}</strong>
        <p id="manual-alert-detail">{!connected && 'Connect a provider on Campaign to receive donations. '}{manual ? 'Donations wait in the list until you click Send to screen. An alert already on screen will finish.' : 'Previously held donations stay in the list until you send them.'}</p>
      </div>
    </section>
    {mustacheRider && <button type="button" className="secondary thermometer-visibility" disabled={disabled} onClick={() => void run('setMustacheRiderThermometer', { visible: !thermometerVisible }, thermometerVisible ? 'Thermometer hiding.' : 'Thermometer showing.')}><Icon name="monitor"/>{thermometerVisible ? 'Hide thermometer' : 'Show thermometer'}</button>}
    </div>
    {connected ? <section className="donation-archive" aria-labelledby="donation-list-heading">
      <div className="donation-table">
      <header className="donation-list-header">
      <div className="donation-archive-heading"><div><h2 id="donation-list-heading">All donations</h2><p>{history.length.toLocaleString()} saved · {unsent.toLocaleString()} not sent</p></div></div>
      <div className="donation-toolbar"><label className="donation-search">Search donations<input type="search" placeholder="Name, message, campaign or amount" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }}/></label><div className="donation-filter-control" role="group" aria-labelledby="donation-filter-label"><span id="donation-filter-label" className="donation-filter-label">Filter</span><div className="donation-filters"><button type="button" aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setPage(0); }}>Show all</button><button type="button" disabled={unsent === 0} aria-pressed={filter === 'unsent'} onClick={() => { setFilter('unsent'); setPage(0); }}>Not sent</button></div></div></div>
      </header>
      {visible.length ? <ul className="donation-entries" aria-label="Saved donations">{visible.map((entry) => <DonationRow key={entry.id} entry={entry} number={donationNumbers.get(entry.id)!} controls={controls} mustacheRider={mustacheRider}/>)}</ul> : <div className="empty-state"><strong>{history.length ? 'No donations match this view.' : 'Your donation list is ready.'}</strong><span>{history.length ? 'Try another search or show all donations.' : 'Donations received from this campaign will be saved here.'}</span>{history.length > 0 && <button className="secondary" onClick={() => { setSearch(''); setFilter('all'); setPage(0); }}>Show all donations</button>}</div>}
      {filtered.length > PAGE_SIZE && <nav className="donation-pagination" aria-label="Donation list pages"><span>Page {currentPage + 1} of {pages} · {filtered.length.toLocaleString()} donations</span><div className="button-row"><button className="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="secondary" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div></nav>}
      </div>
      <p className="fine-print donation-storage-note">Donations, edits and send counts are saved locally and survive restarts. Sent counts include automatic and manual alerts when playback starts; queued alerts are not counted. Counts for older donations start when they are added to this list.</p>
    </section> : <div className="empty-state donation-connect-prompt"><strong>Connect a provider to view donations.</strong><span>Choose a provider and connect on Campaign. Saved donations will appear for that campaign.</span></div>}
  </PanelLayout>;
}
