import type { CampaignState, Donation, ProviderConfig } from '../../shared/models';

export interface FundraisingProvider {
  connect(config: ProviderConfig): Promise<void>;
  getCampaign(): Promise<CampaignState>;
  getRecentDonations(): Promise<Donation[]>;
  disconnect(): Promise<void>;
}
export class ProviderError extends Error {
  constructor(message: string, public readonly retryable = false, public readonly retryAfterMs = 0) { super(message); }
}
export function publicError(error: unknown): string {
  if (error instanceof ProviderError) return error.message;
  return 'The update could not be completed. Your last valid graphics are preserved. Check the server and try again.';
}
