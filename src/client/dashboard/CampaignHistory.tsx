import { providerNames, type CampaignConnection } from '../../shared/models';
import { useReplicant } from '../shared/nodecg';
import { Icon } from './PanelLayout';

const fundraiserNames = { participants: 'Participant', teams: 'Team', events: 'Event' } as const;

export function CampaignHistory({ disabled, onSelect }: { disabled: boolean; onSelect: (entry: CampaignConnection) => void }) {
  const history = useReplicant('campaignHistory').filter((entry) => entry.provider !== 'mock');
  return <section className="card headed-card campaign-history" aria-labelledby="campaign-history-heading">
    <div className="section-heading"><h2 id="campaign-history-heading">Connection history</h2><Icon name="activity"/></div>
    <p className="section-description">Choose a saved campaign to fill in the connection form, then click Connect.</p>
    {history.length ? <ul className="campaign-history-list">{history.map((entry) => <li key={entry.key}>
      <button type="button" className="campaign-history-item" disabled={disabled} aria-label={`Load ${entry.title} from ${providerNames[entry.provider]}`} onClick={() => onSelect(entry)}>
        <span className="campaign-history-title">{entry.title}</span>
        <span className="campaign-history-provider">{providerNames[entry.provider]}{entry.provider === 'donordrive' && ` · ${fundraiserNames[entry.donorDriveResource ?? 'participants']}`}{entry.campaignId && ` · ID ${entry.campaignId}`}</span>
        {entry.campaignUrl && <span className="campaign-history-url">{entry.campaignUrl}</span>}
        <span className="campaign-history-date">Last connected <time dateTime={entry.lastConnectedAt}>{new Date(entry.lastConnectedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></span>
      </button>
    </li>)}</ul> : <p className="campaign-history-empty">No saved connections yet. Campaigns appear here after you connect successfully.</p>}
  </section>;
}
