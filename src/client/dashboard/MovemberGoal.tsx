import { useRef, useState } from 'react';
import type { CampaignState } from '../../shared/models';
import { formatCurrency } from '../../shared/format';
import type { useControls } from './PanelLayout';

export function MovemberGoal({ campaign, controls }: { campaign: CampaignState; controls: ReturnType<typeof useControls> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(campaign.goal));
  const editButton = useRef<HTMLButtonElement>(null);
  const { disabled, busy, run } = controls;
  const amount = Number(draft);
  const valid = draft.trim() !== '' && Number.isFinite(amount) && amount > 0 && amount <= 1e12;
  const finish = () => { setEditing(false); requestAnimationFrame(() => editButton.current?.focus()); };
  const save = async (goal: number | null) => {
    if (await run('setMovemberGoal', { campaignId: campaign.id!, currency: campaign.currency, goal },
      goal === null ? 'Fundraising goal reset to the Movember API amount.' : 'Custom fundraising goal saved. All overlays are updated.')) finish();
  };
  return <div className="stat campaign-goal">
    {editing ? <form className="campaign-goal-form" aria-label="Edit fundraising goal" onSubmit={(event) => {
      event.preventDefault(); if (valid && !disabled) void save(amount);
    }} onKeyDown={(event) => { if (event.key === 'Escape' && !disabled) { event.preventDefault(); finish(); } }}>
      <label>Fundraising goal{campaign.goalOverridden && '*'} ({campaign.currency})<input autoFocus type="number" inputMode="decimal" required min="0.01" max="1000000000000" step="any"
        value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} /></label>
      <div className="campaign-goal-actions"><button className="primary" type="submit" disabled={disabled || !valid}>{busy === 'setMovemberGoal' ? 'Saving…' : 'Save'}</button><button className="secondary" type="button" disabled={disabled} onClick={finish}>Cancel</button></div>
    </form> : <>
      <div className="campaign-goal-heading"><span>Fundraising goal{campaign.goalOverridden && '*'}</span>
      <div className="campaign-goal-label-actions"><button ref={editButton} className="secondary" type="button" aria-label="Edit fundraising goal" disabled={disabled} onClick={() => { setDraft(String(campaign.goal)); setEditing(true); }}>Edit</button>
        {campaign.goalOverridden && <button className="secondary" type="button" aria-label="Reset fundraising goal to API amount" disabled={disabled} onClick={() => void save(null)}>Reset</button>}
      </div></div>
      <div className="campaign-goal-amount"><strong>{campaign.goal > 0 ? formatCurrency(campaign.goal, campaign.currency, Boolean(campaign.goalOverridden) && !Number.isInteger(campaign.goal)) : 'Not set'}</strong>
        {campaign.goalOverridden && <small>*custom goal amount</small>}
      </div>
    </>}
  </div>;
}
