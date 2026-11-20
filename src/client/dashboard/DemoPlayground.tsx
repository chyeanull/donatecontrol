import { useEffect, useState } from 'react';
import { Heart } from '../shared/Graphics';
import { useReplicant } from '../shared/nodecg';
import { SectionTitle, type useControls } from './PanelLayout';

export function DemoPlayground({ controls }: { controls: ReturnType<typeof useControls> }) {
  const { status, connected, disabled, run } = controls;
  const mock = useReplicant('mockState');
  const { manual } = useReplicant('donationControl');
  const [demo, setDemo] = useState({ title: mock.campaign.title, raised: String(mock.campaign.raised), goal: String(mock.campaign.goal) });
  const [donor, setDonor] = useState('Rob');
  const [amount, setAmount] = useState('50');
  const [message, setMessage] = useState('');
  useEffect(() => setDemo({ title: mock.campaign.title, raised: String(mock.campaign.raised), goal: String(mock.campaign.goal) }), [mock.campaign.title, mock.campaign.raised, mock.campaign.goal]);
  const demoActive = connected && status.provider === 'mock';
  const number = (value: string) => value.trim() ? Number(value) : NaN;
  if (!demoActive) return null;
  return <section className="card headed-card demo-controls"><SectionTitle step="03" title="Demo playground"><span className="demo-tag">MOCK MODE</span></SectionTitle>
      <p className="section-description">A practice run for the real thing.</p>
      <form onSubmit={(event) => { event.preventDefault(); void run('editMock', { title: demo.title, raised: number(demo.raised), goal: number(demo.goal) }, 'Demo campaign updated.'); }}><fieldset disabled={disabled || !demoActive}><label>Campaign title<input required maxLength={120} value={demo.title} onChange={(event) => setDemo({ ...demo, title: event.target.value })}/></label><div className="two-fields"><label>Amount raised · USD<input required type="number" min="0" max="1000000000000" step="0.01" value={demo.raised} onChange={(event) => setDemo({ ...demo, raised: event.target.value })}/></label><label>Goal · USD<input required type="number" min="0" max="1000000000000" step="0.01" value={demo.goal} onChange={(event) => setDemo({ ...demo, goal: event.target.value })}/></label></div><div className="button-row"><button className="secondary">Update campaign</button><button className="quiet" type="button" onClick={() => void run('resetMock', undefined, 'Demo restored to Charity Stream, $12,500 / $25,000.')}>Reset demo</button></div></fieldset></form>
      <form className="fake-donation" onSubmit={(event) => { event.preventDefault(); void run('addMockDonation', { donorName: donor, amount: number(amount), message }, manual ? 'Demo donation saved. Send it from Donation List & Alerts.' : 'Demo donation added.'); }}><fieldset disabled={disabled || !demoActive}><div className="two-fields"><label>Donor name<input maxLength={80} placeholder="Anonymous" value={donor} onChange={(event) => setDonor(event.target.value)}/></label><label>Donation · USD<input type="number" required min="0.01" max="1000000000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)}/></label></div><label className="demo-message">Donation message <span className="optional-inline">Optional</span><input maxLength={2000} value={message} placeholder="A message of support" onChange={(event) => setMessage(event.target.value)}/></label><button className="primary send-donation" disabled={controls.sendLocked}><Heart/>Send Test Donation</button></fieldset><p className="fine-print">Adds to the demo total. Manual control holds the donation in Donation List & Alerts; otherwise it plays automatically.</p></form>
  </section>;
}
