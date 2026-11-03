import { ProviderError } from '../providers/FundraisingProvider';

export function backoffMs(failures: number, intervalMs: number, retryAfterMs = 0): number {
  return Math.max(retryAfterMs, Math.min(300000, intervalMs * 2 ** Math.min(failures, 5)));
}
export class PollingService {
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private failures = 0;
  private stopped = true;
  private nextAllowed = 0;
  private terminal = false;
  constructor(private readonly task: () => Promise<void>, private readonly interval: () => number,
    private readonly onError: (error: unknown, nextRetryAt: string | null) => void) {}
  start() { this.stopped = false; this.terminal = false; return this.refresh(); }
  stop() { this.stopped = true; clearTimeout(this.timer); }
  refresh(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) return this.running;
    if (this.terminal) return Promise.reject(new ProviderError('Reconnect after correcting the campaign or API configuration.'));
    if (Date.now() < this.nextAllowed) return Promise.reject(new ProviderError('Waiting for the API retry delay. Refresh will resume automatically.'));
    clearTimeout(this.timer);
    this.running = this.task().then(() => { this.failures = 0; this.nextAllowed = 0; }).catch((error: unknown) => {
      if (this.stopped) return;
      const retryable = error instanceof ProviderError && error.retryable;
      this.terminal = !retryable;
      this.nextAllowed = retryable ? Date.now() + backoffMs(++this.failures, this.interval(), error.retryAfterMs) : 0;
      this.onError(error, retryable ? new Date(this.nextAllowed).toISOString() : null);
      throw error;
    }).finally(() => {
      this.running = undefined;
      if (!this.stopped && !this.terminal) {
        const delay = Math.max(this.interval(), this.nextAllowed - Date.now());
        this.timer = setTimeout(() => { void this.refresh().catch(() => {}); }, Math.min(delay, 2147483647));
      }
    });
    return this.running;
  }
}
