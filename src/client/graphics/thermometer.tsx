import { createRoot } from 'react-dom/client';
import { Thermometer } from '../shared/Graphics';
import { useCampaignConnected, useReplicant } from '../shared/nodecg';
import { resolveOverlayAppearance } from '../../shared/appearance';
import './overlay.css';
function Graphic() {
  const campaign = useReplicant('campaign');
  const connected = useCampaignConnected();
  const { thermometerVisible } = useReplicant('mustacheRiderControls');
  const appearance = resolveOverlayAppearance(useReplicant('overlayAppearance'));
  return <div className="thermometer-stage">{connected && <Thermometer campaign={campaign} {...appearance} animation={appearance.thermometerAnimation} visible={appearance.theme !== 'mustacherider' || thermometerVisible} />}</div>;
}
createRoot(document.getElementById('root')!).render(<Graphic />);
