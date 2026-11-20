import { useEffect, useRef, useState } from 'react';
import type { DonationAlert } from '../../shared/models';
import { useReplicant } from '../shared/nodecg';
import { createMustacheRiderAudio, type MustacheRiderAudio } from '../shared/mustacheRiderAudio';

export function MustacheRiderSound({ alert }: { alert: DonationAlert }) {
  const { volume } = useReplicant('alertSound');
  const player = useRef<MustacheRiderAudio | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const sounds = createMustacheRiderAudio({ onBlocked: setBlocked });
    player.current = sounds;
    return () => { sounds.stop(); player.current = null; };
  }, []);
  useEffect(() => { player.current?.setVolume(volume); }, [volume]);
  useEffect(() => {
    if (alert.visible && alert.donation?.id && alert.playback?.receiptMode !== 'fade') player.current?.play();
    return () => player.current?.stop();
  }, [alert.donation?.id, alert.visible, alert.playback?.receiptMode]);
  return blocked && alert.visible && alert.playback?.receiptMode !== 'fade' && volume > 0
    ? <button className="enable-alert-sound" onClick={() => player.current?.unlock()}>Enable sound</button>
    : null;
}
