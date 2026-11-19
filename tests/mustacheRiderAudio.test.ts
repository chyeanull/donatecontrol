import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMustacheRiderAudio } from '../src/client/shared/mustacheRiderAudio';

class FakeAudio {
  static instances: FakeAudio[] = [];
  preload = '';
  currentTime = 0;
  volume = 1;
  duration: number;
  onended: (() => void) | null = null;
  play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  pause = vi.fn();
  constructor(readonly src: string) {
    this.duration = src.includes('cha-ching') ? 3.742 : src.includes('print-receipt') ? 3.209 : 1.511;
    FakeAudio.instances.push(this);
  }
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  FakeAudio.instances = [];
  vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('MustacheRider receipt sound sequence', () => {
  it('plays the register lead-in before printing, then rips at tear-off', async () => {
    const onEnded = vi.fn();
    const player = createMustacheRiderAudio({ onEnded });
    const [cash, printer, rip] = FakeAudio.instances;
    player.setVolume(.4); player.play();
    expect(cash.play).toHaveBeenCalledTimes(1);
    expect(printer.play).not.toHaveBeenCalled(); expect(rip.play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1499);
    expect(printer.play).not.toHaveBeenCalled(); expect(rip.play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(cash.pause).toHaveBeenCalledTimes(2);
    expect(printer.play).toHaveBeenCalledTimes(1);
    player.setVolume(.2);
    expect(FakeAudio.instances.every(audio => audio.volume === .2)).toBe(true);
    expect(cash.play).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2400);
    expect(printer.pause).toHaveBeenCalledTimes(2); // reset, then tear-off
    expect(rip.play).toHaveBeenCalledTimes(1);
    cash.onended?.(); rip.onended?.();
    expect(onEnded).toHaveBeenCalledTimes(1);
    player.play(); expect(cash.play).toHaveBeenCalledTimes(2);
    player.stop();
  });

  it('cancels future sounds when the alert closes or the preview stops', async () => {
    const player = createMustacheRiderAudio();
    player.play(); await vi.advanceTimersByTimeAsync(100); player.stop();
    await vi.advanceTimersByTimeAsync(9000);
    const [cash, printer, rip] = FakeAudio.instances;
    expect(cash.currentTime).toBe(0);
    expect(printer.play).not.toHaveBeenCalled(); expect(rip.play).not.toHaveBeenCalled();
  });

  it('resumes only the current cue after a late autoplay unlock', async () => {
    const onBlocked = vi.fn();
    const player = createMustacheRiderAudio({ onBlocked });
    const [cash, printer, rip] = FakeAudio.instances;
    for (const track of FakeAudio.instances) track.play.mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'));
    player.play(); await vi.advanceTimersByTimeAsync(5300);
    expect(onBlocked).toHaveBeenCalledWith(true);
    player.unlock();
    expect(cash.play).toHaveBeenCalledTimes(1);
    expect(printer.play).toHaveBeenCalledTimes(1);
    expect(rip.play).toHaveBeenCalledTimes(2);
    expect(rip.currentTime).toBeCloseTo(1.4);
    player.stop();
  });

  it('ignores rejected playback promises after cancellation', async () => {
    const onBlocked = vi.fn();
    const player = createMustacheRiderAudio({ onBlocked });
    let reject!: (reason: unknown) => void;
    FakeAudio.instances[0].play.mockImplementationOnce(() => new Promise((_, no) => { reject = no; }));
    player.play(); player.stop();
    reject(new DOMException('Blocked', 'NotAllowedError'));
    await Promise.resolve();
    expect(onBlocked).not.toHaveBeenCalledWith(true);
  });
});
