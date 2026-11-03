import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCard } from '../shared/Graphics';
import { AlertCanvas } from '../shared/AlertCanvas';
import { useCampaignConnected, useReplicant } from '../shared/nodecg';
import type { DonationAlert } from '../../shared/models';
import './overlay.css';
import { AlertSound } from './AlertSound';
import { resolveOverlayAppearance } from '../../shared/appearance';
const testMode = new URLSearchParams(location.search).get('test') === '1';
function TestGraphic() {
  const appearance = resolveOverlayAppearance(useReplicant('overlayAppearance'));
  const { alertDurationSeconds } = useReplicant('settings');
  const { alertAnimation: animation, animationInMs, animationOutMs } = appearance;
  const [alert, setAlert] = useState<DonationAlert>({ donation: null, visible: false, queued: 0 });
  useEffect(() => {
    let count = 0;
    let hide: ReturnType<typeof setTimeout>;
    let repeat: ReturnType<typeof setTimeout>;
    const show = () => {
      setAlert({ donation: { id: `local-test-${++count}`, donorName: ['Alex Morgan', 'Rob', 'Anonymous'][count % 3], amount: 25 + (count % 4) * 25,
        message: count % 2 ? 'Proud to support this community. Keep going!' : undefined, currency: 'USD', timestamp: new Date().toISOString(), anonymous: count % 3 === 2, test: true }, visible: true, queued: 0,
        playback: { animation, animationInMs, animationOutMs } });
      const visibleMs = animationInMs + alertDurationSeconds * 1000;
      hide = setTimeout(() => setAlert((value) => ({ ...value, visible: false })), visibleMs);
      repeat = setTimeout(show, visibleMs + animationOutMs + 1000);
    };
    show();
    return () => { clearTimeout(repeat); clearTimeout(hide); };
  }, [animation, animationInMs, animationOutMs, alertDurationSeconds]);
  return <div className="alert-stage"><AlertCanvas><AlertCard alert={alert} {...appearance} animation={appearance.alertAnimation} {...alert.playback} /></AlertCanvas></div>;
}
function LiveGraphic() {
  const alert = useReplicant('currentAlert');
  const connected = useCampaignConnected();
  const appearance = resolveOverlayAppearance(useReplicant('overlayAppearance'));
  const show = connected || (alert.donation?.test === true && !alert.entryId);
  return <div className="alert-stage">{show && <><AlertCanvas><AlertCard alert={alert} {...appearance} animation={appearance.alertAnimation} {...alert.playback} /></AlertCanvas><AlertSound alert={alert}/></>}</div>;
}
createRoot(document.getElementById('root')!).render(testMode ? <TestGraphic /> : <LiveGraphic />);
