import { useEffect, useRef, useState } from 'react';
import { BUNDLE } from '../../shared/models';
import { authenticatedUrl, useReplicant } from '../shared/nodecg';
import { notify } from './notifications';

export function SoundPreview({ disabled, volume: previewVolume, label = 'Preview sound', stopLabel = 'Stop sound preview' }: {
  disabled: boolean; volume?: number; label?: string; stopLabel?: string;
}) {
  const sound = useReplicant('alertSound');
  const volume = previewVolume ?? sound.volume;
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);
  useEffect(() => { audio.current?.pause(); setPlaying(false); }, [sound.file]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  const preview = async () => {
    if (playing) { audio.current?.pause(); setPlaying(false); return; }
    if (!sound.file) return;
    audio.current?.pause();
    const player = new Audio(authenticatedUrl(`/${BUNDLE}/alert-sound/file/${sound.file}`));
    audio.current = player; player.volume = volume;
    player.onended = () => setPlaying(false);
    try { await player.play(); setPlaying(true); }
    catch { notify.error('This browser could not play the file. Try another MP3, WAV, or OGG sound.'); }
  };
  return <button type="button" className="secondary" disabled={disabled || !sound.file}
    title={!sound.file ? 'Upload a sound file first' : undefined}
    onClick={() => void preview()}>{playing ? stopLabel : label}</button>;
}
