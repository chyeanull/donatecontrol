import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertGraphic } from '../shared/AlertGraphic';
import { useCampaignConnected, useReplicant } from '../shared/nodecg';
import type { DonationAlert } from '../../shared/models';
import './overlay.css';
import { AlertSound } from './AlertSound';
import { resolveAlertPlayback, resolveOverlayAppearance } from '../../shared/appearance';
const testMode = new URLSearchParams(location.search).get('test') === '1';
function TestGraphic() {
  const appearance = resolveOverlayAppearance(useReplicant('overlayAppearance'));
  const { alertDurationSeconds } = useReplicant('settings');
  const playback = resolveAlertPlayback(appearance, alertDurationSeconds);
  const { theme, animation, animationInMs, animationOutMs, holdMs } = playback;
  const [alert, setAlert] = useState<DonationAlert>({ donation: null, visible: false, queued: 0 });
  useEffect(() => {
    let count = 0;
    let hide: ReturnType<typeof setTimeout>;
    let repeat: ReturnType<typeof setTimeout>;
    const show = () => {
      setAlert({ donation: { id: `local-test-${++count}`, donorName: ['Alex Morgan', 'Rob', 'Anonymous'][count % 3], amount: 25 + (count % 4) * 25,
        message: count % 2 ? 'Proud to support this community. Keep going!' : undefined, currency: 'USD', timestamp: new Date().toISOString(), anonymous: count % 3 === 2, test: true }, visible: true, queued: 0,
        playback: { theme, animation, animationInMs, animationOutMs, holdMs } });
      const visibleMs = animationInMs + holdMs;
      hide = setTimeout(() => setAlert((value) => ({ ...value, visible: false })), visibleMs);
      repeat = setTimeout(show, visibleMs + animationOutMs + 1000);
    };
    show();
    return () => { clearTimeout(repeat); clearTimeout(hide); };
  }, [theme, animation, animationInMs, animationOutMs, holdMs]);
  return <div className="alert-stage"><AlertGraphic alert={alert} {...appearance} animation={appearance.alertAnimation} {...alert.playback} /></div>;
}
function LiveGraphic() {
  const alert = useReplicant('currentAlert');
  const connected = useCampaignConnected();
  const appearance = resolveOverlayAppearance(useReplicant('overlayAppearance'));
  const show = connected || (alert.donation?.test === true && !alert.entryId);
  return <div className="alert-stage">{show && <><AlertGraphic alert={alert} {...appearance} animation={appearance.alertAnimation} {...alert.playback} /><AlertSound alert={alert}/></>}</div>;
}
createRoot(document.getElementById('root')!).render(testMode ? <TestGraphic /> : <LiveGraphic />);
