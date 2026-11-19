import { mustacheRiderMotion as timing } from '../../shared/mustacheRider';

const cues = [
  { url: new URL('./audio/mustacherider/cha-ching.mp3', import.meta.url).href, at: 0, until: timing.cashLeadInMs },
  { url: new URL('./audio/mustacherider/print-receipt.mp3', import.meta.url).href, at: timing.cashLeadInMs, until: timing.cashLeadInMs + timing.printMs },
  { url: new URL('./audio/mustacherider/paper-rip.mp3', import.meta.url).href, at: timing.cashLeadInMs + timing.printMs },
];

/** One reusable, preloaded player for live receipts and the local sound test. */
export function createMustacheRiderAudio(callbacks: {
  onBlocked?: (blocked: boolean) => void;
  onEnded?: () => void;
  onError?: () => void;
} = {}) {
  const tracks = cues.map(cue => {
    const audio = new Audio(cue.url);
    audio.preload = 'auto';
    return { ...cue, audio, done: false };
  });
  let timers: ReturnType<typeof setTimeout>[] = [];
  let startedAt: number | null = null;
  let generation = 0;
  let blocked = false;
  const reportBlocked = (value: boolean) => { blocked = value; callbacks.onBlocked?.(value); };
  const finished = () => {
    if (startedAt !== null && tracks.every(track => track.done)) {
      startedAt = null; reportBlocked(false); callbacks.onEnded?.();
    }
  };
  const stop = () => {
    generation++;
    timers.forEach(clearTimeout); timers = []; startedAt = null;
    tracks.forEach(({ audio }) => { audio.onended = null; audio.pause(); audio.currentTime = 0; });
    reportBlocked(false);
  };
  const playTrack = (track: typeof tracks[number], elapsed: number) => {
    if (track.done || elapsed < track.at) return;
    const end = track.until ?? track.at + track.audio.duration * 1000;
    if (elapsed >= end) { track.done = true; finished(); return; }
    const currentGeneration = generation;
    track.audio.currentTime = Math.max(0, elapsed - track.at) / 1000;
    track.audio.onended = () => {
      if (generation !== currentGeneration) return;
      track.done = true; finished();
    };
    void track.audio.play().catch((error: unknown) => {
      if (generation !== currentGeneration || track.done) return;
      if (error instanceof DOMException && error.name === 'NotAllowedError') reportBlocked(true);
      else { track.done = true; callbacks.onError?.(); finished(); }
    });
  };
  return {
    play() {
      stop();
      tracks.forEach(track => { track.done = false; });
      startedAt = performance.now();
      for (const track of tracks) {
        const begin = () => { if (startedAt !== null) playTrack(track, performance.now() - startedAt); };
        if (track.at === 0) begin(); else timers.push(setTimeout(begin, track.at));
        if (track.until !== undefined) timers.push(setTimeout(() => {
          track.audio.pause(); track.done = true; finished();
        }, track.until));
      }
    },
    // An autoplay unlock joins the current sound cue instead of replaying old cues.
    unlock() {
      if (!blocked || startedAt === null) return;
      const elapsed = performance.now() - startedAt;
      reportBlocked(false);
      tracks.forEach(track => playTrack(track, elapsed));
    },
    setVolume(volume: number) { tracks.forEach(({ audio }) => { audio.volume = Math.max(0, Math.min(1, volume)); }); },
    stop,
  };
}

export type MustacheRiderAudio = ReturnType<typeof createMustacheRiderAudio>;
