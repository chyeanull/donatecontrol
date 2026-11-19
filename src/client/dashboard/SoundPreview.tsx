import { useEffect, useRef, useState } from 'react';
import { BUNDLE } from '../../shared/models';
import { authenticatedUrl, useReplicant } from '../shared/nodecg';
import { notify } from './notifications';
import { createMustacheRiderAudio, type MustacheRiderAudio } from '../shared/mustacheRiderAudio';

type Props = { disabled: boolean; volume?: number; label?: string; stopLabel?: string; receipt?: boolean };

export function SoundPreview(props: Props) {
  return props.receipt ? <ReceiptSoundPreview {...props}/> : <UploadedSoundPreview {...props}/>;
}

function ReceiptSoundPreview({ disabled, volume = 1, label = 'Test alert sound', stopLabel = 'Stop sound test' }: Props) {
  const [playing, setPlaying] = useState(false);
  const player = useRef<MustacheRiderAudio | null>(null);
  useEffect(() => {
    const fail = () => {
      player.current?.stop(); setPlaying(false);
      notify.error('This browser could not play the receipt sounds. Try the sound test again.');
    };
    const sounds = createMustacheRiderAudio({ onEnded: () => setPlaying(false), onBlocked: blocked => { if (blocked) fail(); }, onError: fail });
    player.current = sounds;
    return () => { sounds.stop(); player.current = null; };
  }, []);
  useEffect(() => { player.current?.setVolume(volume); }, [volume]);
  useEffect(() => { if (disabled) { player.current?.stop(); setPlaying(false); } }, [disabled]);
  return <button type="button" className="secondary" disabled={disabled} onClick={() => {
    if (playing) { player.current?.stop(); setPlaying(false); }
    else { player.current?.play(); setPlaying(true); }
  }}>{playing ? stopLabel : label}</button>;
}

function UploadedSoundPreview({ disabled, volume: previewVolume, label = 'Preview sound', stopLabel = 'Stop sound preview' }: Props) {
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
