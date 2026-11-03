import { defaultAlertPlayback, type AlertPlayback, type Donation, type DonationAlert } from '../../shared/models';

interface QueueItem { donation: Donation; entryId?: string }
export class AlertQueue {
  private pending: QueueItem[] = [];
  private seen = new Set<string>();
  private current: QueueItem | null = null;
  private visible = false;
  private playback: AlertPlayback = { ...defaultAlertPlayback };
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private readonly publish: (value: DonationAlert) => void, private readonly duration: () => number,
    private readonly log: (message: string) => void = () => {},
    private readonly onStart: (entryId: string) => void = () => {},
    private readonly getPlayback: () => AlertPlayback = () => defaultAlertPlayback) {}
  private emit() { this.publish({ donation: this.current?.donation ?? null, visible: this.visible, queued: this.pending.length,
    entryId: this.current?.entryId ?? null, queuedEntryIds: this.pending.flatMap((item) => item.entryId ? [item.entryId] : []),
    ...(this.current ? { playback: { ...this.playback } } : {}) }); }
  enqueue(donation: Donation, entryId?: string) {
    const key = JSON.stringify([entryId, donation.id]);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.seen.size > 20000) this.seen.delete(this.seen.values().next().value!);
    this.pending.push({ donation, entryId });
    if (!this.current) this.advance(); else this.emit();
  }
  private advance() {
    this.current = this.pending.shift() ?? null;
    // Keep timer and graphic timings together for the whole alert. New settings
    // are picked up by the next alert, including items already waiting to play.
    if (this.current) this.playback = { ...this.getPlayback() };
    this.visible = this.current !== null;
    this.emit();
    if (this.current?.entryId) this.onStart(this.current.entryId);
    if (this.current) this.timer = setTimeout(() => this.dismiss(), this.playback.animationInMs + this.duration() * 1000);
  }
  dismiss() {
    if (!this.current || !this.visible) return;
    clearTimeout(this.timer);
    this.visible = false;
    this.emit();
    this.timer = setTimeout(() => { this.log('Alert completed'); this.current = null; this.advance(); }, this.playback.animationOutMs);
  }
  clear() { this.pending = []; this.emit(); }
  updatePending(entryId: string, content: Pick<Donation, 'donorName' | 'message'>) {
    this.pending = this.pending.map((item) => item.entryId === entryId
      ? { ...item, donation: { ...item.donation, ...content } } : item);
  }
  stop() { clearTimeout(this.timer); this.pending = []; this.current = null; this.visible = false; this.emit(); }
}
