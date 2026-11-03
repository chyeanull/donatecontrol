import { z } from 'zod';
import { overlayFonts } from './fonts';

export const BUNDLE = 'gofundme-live';
export const DEFAULT_ANIMATION_IN_MS = 500;
export const DEFAULT_ANIMATION_OUT_MS = 400;
export const MAX_ANIMATION_MS = 10000;
export const animationMsSchema = z.number().int().min(0).max(MAX_ANIMATION_MS);
export const overlayAnimationSchema = z.enum(['draw-left', 'rise-fade', 'soft-zoom']);
export type OverlayAnimation = z.infer<typeof overlayAnimationSchema>;
export const alertPlaybackSchema = z.object({ animation: overlayAnimationSchema, animationInMs: animationMsSchema, animationOutMs: animationMsSchema });
export type AlertPlayback = z.infer<typeof alertPlaybackSchema>;
export const defaultAlertPlayback: AlertPlayback = { animation: 'draw-left', animationInMs: DEFAULT_ANIMATION_IN_MS, animationOutMs: DEFAULT_ANIMATION_OUT_MS };
const money = z.number().finite().min(0).max(1e12);
const currency = z.string().regex(/^[A-Z]{3}$/);
const date = z.string().nullable();
export const providerSchema = z.enum(['mock', 'gofundme-pro', 'donordrive', 'givebutter']);
export const providerNames = { mock: 'Mock / Demo', 'gofundme-pro': 'GoFundMe Pro', donordrive: 'DonorDrive', givebutter: 'Givebutter' } as const;
export const donorDriveResourceSchema = z.enum(['participants', 'teams', 'events']);
export const campaignSchema = z.object({
  id: z.string().nullable(), url: z.string(), title: z.string(), currency,
  raised: money, goal: money, percent: z.number().finite().min(0),
  donationCount: z.number().int().nonnegative().optional(),
  lastUpdated: date, connected: z.boolean(),
});
export const settingsSchema = z.object({
  provider: providerSchema, campaignUrl: z.string().max(2048),
  campaignId: z.string().max(40).default(''),
  // Optional in persisted JSON so older NodeCG settings are retained on upgrade.
  donorDriveResource: donorDriveResourceSchema.default('participants').optional(),
  pollingIntervalSeconds: z.number().int().min(10).max(300),
  // Compatibility with saved settings and older clients; delivery uses donationControl.
  alertsEnabled: z.boolean().default(true), alertDurationSeconds: z.number().min(2).max(30),
});
export const connectionSchema = z.object({
  state: z.enum(['disconnected', 'connecting', 'connected', 'error']),
  provider: providerSchema, message: z.string(), lastSuccessfulFetch: date,
  nextRetryAt: date,
});
export const campaignConnectionSchema = settingsSchema.pick({ provider: true, campaignUrl: true, campaignId: true, donorDriveResource: true }).extend({
  key: z.string(), title: z.string(), lastConnectedAt: z.string(),
});
export type CampaignConnection = z.infer<typeof campaignConnectionSchema>;
export const donationSchema = z.object({
  id: z.string(), donorName: z.string(), amount: money, currency, timestamp: z.string(),
  anonymous: z.boolean(), test: z.boolean().optional(),
  message: z.string().max(2000).optional(),
});
export const alertSchema = z.object({
  donation: donationSchema.nullable(), visible: z.boolean(), queued: z.number().int().nonnegative(),
  entryId: z.string().nullable().optional(), queuedEntryIds: z.array(z.string()).optional(),
  playback: alertPlaybackSchema.optional(),
});
export const donationEntrySchema = z.object({
  id: z.string(), campaignKey: z.string(), campaignTitle: z.string(),
  donation: donationSchema, donorName: z.string(), message: z.string().max(2000),
  receivedAt: z.string(), editedAt: date, sentCount: z.number().int().nonnegative(), lastSentAt: date,
});
export const editDonationSchema = z.object({
  entryId: z.string().min(1), donorName: z.string().trim().min(1).max(200), message: z.string().trim().max(2000),
}).strict();
export const eventSchema = z.object({ id: z.string(), timestamp: z.string(), message: z.string(), level: z.enum(['info', 'error']) });
export const ledgerSchema = z.object({ campaignKey: z.string(), seenIds: z.array(z.string()), cutoff: z.string().nullable() });
export const mockEditSchema = z.object({ title: z.string().trim().min(1).max(120), raised: money, goal: money });
export const mockDonationSchema = z.object({ donorName: z.string().trim().max(80), amount: money.positive(), message: z.string().trim().max(2000).optional() });
export const credentialStatusSchema = z.object({
  configured: z.boolean(), source: z.enum(['none', 'environment', 'dashboard']),
  saved: z.boolean(), storageError: z.boolean(),
});
export const alertSoundSchema = z.object({
  file: z.string().regex(/^[a-f0-9-]{36}\.(mp3|wav|ogg)$/).nullable(), name: z.string().max(200),
  enabled: z.boolean(), volume: z.number().min(0).max(1),
});
export const overlayThemeSchema = z.enum(['classic', 'quest', 'bwf']);
export type OverlayTheme = z.infer<typeof overlayThemeSchema>;
export const overlayAnimationNames: Record<OverlayAnimation, string> = {
  'draw-left': 'Draw from left', 'rise-fade': 'Rise & fade', 'soft-zoom': 'Soft zoom',
};
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const classicColorsSchema = z.object({ font: hexColorSchema, accent: hexColorSchema, background: hexColorSchema });
export type ClassicColors = z.infer<typeof classicColorsSchema>;
export const defaultClassicColors: ClassicColors = { font: '#f8faf5', accent: '#b5f36d', background: '#141a19' };
export const donationIconSchema = z.enum(['heart', 'smile', 'gift', 'praying-hands', 'hand-heart', 'handshake', 'star', 'ribbon', 'coin', 'sprout']);
export type DonationIconName = z.infer<typeof donationIconSchema>;
export const donationIconNames: Record<DonationIconName, string> = {
  heart: 'Heart', smile: 'Happy face', gift: 'Gift', 'praying-hands': 'Praying hands', 'hand-heart': 'Giving hand',
  handshake: 'Handshake', star: 'Star', ribbon: 'Ribbon', coin: 'Coin', sprout: 'Sprout',
};
export const customBorderWidthSchema = z.number().int().min(0).max(10);
export const customThemeSchema = z.object({
  borderWidth: customBorderWidthSchema, corners: z.enum(['rounded', 'straight']),
  // Icon preferences are shared by all themes; retained here for saved-data compatibility.
  iconEnabled: z.boolean(), icon: donationIconSchema,
  fontFamily: z.enum(overlayFonts).optional(),
});
export type CustomTheme = z.infer<typeof customThemeSchema>;
export const defaultCustomTheme: CustomTheme = { borderWidth: 1, corners: 'rounded', iconEnabled: true, icon: 'heart', fontFamily: 'Inter' };
// Optional fields keep existing saved themes valid when NodeCG loads older data.
export const overlayAppearanceSchema = z.object({ theme: overlayThemeSchema,
  // Legacy shared style is retained for older dashboards and saved data.
  animation: overlayAnimationSchema.optional(),
  alertAnimation: overlayAnimationSchema.optional(), thermometerAnimation: overlayAnimationSchema.optional(), classicColors: classicColorsSchema.optional(), customTheme: customThemeSchema.optional(),
  animationInMs: animationMsSchema.optional(), animationOutMs: animationMsSchema.optional() });
export const schemas = {
  campaign: campaignSchema, settings: settingsSchema, connectionStatus: connectionSchema,
  campaignHistory: z.array(campaignConnectionSchema),
  recentDonations: z.array(donationSchema).max(50), currentAlert: alertSchema,
  donationHistory: z.array(donationEntrySchema), donationControl: z.object({ manual: z.boolean() }),
  eventLog: z.array(eventSchema).max(50), donationLedger: ledgerSchema,
  mockState: z.object({ campaign: campaignSchema, donations: z.array(donationSchema).max(1000) }),
  credentialStatus: credentialStatusSchema,
  givebutterCredentialStatus: credentialStatusSchema,
  alertSound: alertSoundSchema,
  overlayAppearance: overlayAppearanceSchema,
};
export type CampaignState = z.infer<typeof campaignSchema>;
export type SettingsState = z.infer<typeof settingsSchema>;
export type ConnectionStatus = z.infer<typeof connectionSchema>;
export type Donation = z.infer<typeof donationSchema>;
export type DonationEntry = z.infer<typeof donationEntrySchema>;
export type DonationAlert = z.infer<typeof alertSchema>;
export type EventEntry = z.infer<typeof eventSchema>;
export type DonationLedger = z.infer<typeof ledgerSchema>;
export type MockState = z.infer<typeof schemas.mockState>;
export type CredentialStatus = z.infer<typeof credentialStatusSchema>;
export type AlertSoundState = z.infer<typeof alertSoundSchema>;
export type Replicants = { [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]> };
export type ProviderConfig = Pick<SettingsState, 'campaignId' | 'campaignUrl'> & Partial<Pick<SettingsState, 'donorDriveResource'>>;
export type Commands = {
  connect: SettingsState; refresh: undefined; disconnect: undefined;
  saveSettings: Pick<SettingsState, 'pollingIntervalSeconds' | 'alertDurationSeconds'>;
  testAlert: undefined; clearQueue: undefined; dismissAlert: undefined;
  resendDonation: { donationId: string };
  sendDonation: { entryId: string };
  editDonation: z.infer<typeof editDonationSchema>;
  resetDonation: { entryId: string };
  setManualAlertControl: { manual: boolean };
  saveAlertSound: Pick<AlertSoundState, 'enabled' | 'volume'>;
  saveOverlayAppearance: z.infer<typeof overlayAppearanceSchema>;
  editMock: z.infer<typeof mockEditSchema>; addMockDonation: z.infer<typeof mockDonationSchema>; resetMock: undefined;
};
export const emptyCampaign: CampaignState = {
  id: null, url: '', title: 'Your next good thing starts here', currency: 'USD', raised: 0,
  goal: 0, percent: 0, lastUpdated: null, connected: false,
};
export const defaultSettings: SettingsState = {
  provider: 'mock', campaignUrl: '', campaignId: '', donorDriveResource: 'participants', pollingIntervalSeconds: 15,
  alertsEnabled: true, alertDurationSeconds: 6,
};
export const defaults: Replicants = {
  campaign: emptyCampaign, settings: defaultSettings,
  campaignHistory: [],
  connectionStatus: { state: 'disconnected', provider: 'mock', message: 'Ready when you are. Connect a campaign to begin.', lastSuccessfulFetch: null, nextRetryAt: null },
  recentDonations: [], currentAlert: { donation: null, visible: false, queued: 0, entryId: null, queuedEntryIds: [] },
  donationHistory: [], donationControl: { manual: false },
  eventLog: [], donationLedger: { campaignKey: '', seenIds: [], cutoff: null },
  mockState: {
    campaign: { ...emptyCampaign, id: 'demo', title: 'Charity Stream', raised: 12500, goal: 25000, percent: 50, donationCount: 128 },
    donations: [],
  },
  credentialStatus: { configured: false, source: 'none', saved: false, storageError: false },
  givebutterCredentialStatus: { configured: false, source: 'none', saved: false, storageError: false },
  alertSound: { file: null, name: '', enabled: false, volume: 0.7 },
  overlayAppearance: { theme: 'classic', ...defaultAlertPlayback, classicColors: defaultClassicColors },
};
