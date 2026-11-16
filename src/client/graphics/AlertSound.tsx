import { useEffect, useRef, useState } from 'react';
import type { DonationAlert } from '../../shared/models';
import { BUNDLE } from '../../shared/models';
import { authenticatedUrl, useReplicant } from '../shared/nodecg';

export function AlertSound({ alert }: { alert: DonationAlert }) {
  const sound = useReplicant('alertSound');
  const config = useRef(sound); config.current = sound;
  const audio = useRef<HTMLAudioElement | null>(null);
  const lastId = useRef<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const stop = () => { const player = audio.current; audio.current = null; player?.pause(); if (player) player.currentTime = 0; };
    setBlocked(false);
    if (!alert.visible) { lastId.current = null; stop(); return; }
    const id = alert.donation?.id;
    if (!id || id === lastId.current) return;
    stop();
    const current = config.current;
    // A disconnected test can mount this component before the sound Replicant
    // arrives. Wait for usable settings before marking this playback handled.
    if (!current.enabled || !current.file) return;
    lastId.current = id;
    const player = new Audio(authenticatedUrl(`/${BUNDLE}/alert-sound/file/${current.file}`));
    audio.current = player; player.volume = current.volume;
    void player.play().then(() => { if (audio.current === player) setBlocked(false); }).catch((error: unknown) => {
      if (audio.current === player && error instanceof DOMException && error.name === 'NotAllowedError') setBlocked(true);
    });
    return stop;
  }, [alert.donation?.id, alert.visible, sound.enabled, sound.file]);
  useEffect(() => {
    if (audio.current) audio.current.volume = sound.volume;
    if (!sound.enabled || !sound.file) { audio.current?.pause(); setBlocked(false); }
  }, [sound.volume, sound.enabled, sound.file]);
  return blocked && alert.visible && sound.enabled ? <button className="enable-alert-sound" onClick={() => {
    const player = audio.current;
    void player?.play().then(() => { if (audio.current === player) setBlocked(false); }).catch(() => {});
  }}>Enable sound</button> : null;
}
