import type NodeCG from 'nodecg/types';
import { config as loadEnv } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { BUNDLE, defaults, schemas, settingsSchema, alertSoundSchema, overlayAppearanceSchema, overlayAnimationNames, mockEditSchema, mockDonationSchema, editDonationSchema, type Commands, type Replicants } from '../shared/models';
import { CampaignService, type StateStore } from './services/campaignService';
import { ProviderError, publicError } from './providers/FundraisingProvider';
import { CredentialStore, GivebutterCredentialStore, givebutterCredentialsSchema } from './services/credentialStore';
import { mountCredentialRoutes, mountSecretRoutes } from './credentialRoutes';
import { AlertSoundFiles } from './services/alertSoundFiles';
import { mountAlertSoundRoutes } from './alertSoundRoutes';
import { resolveOverlayAppearance } from '../shared/appearance';

export default function extension(nodecg: NodeCG.ServerAPI) {
  loadEnv({ quiet: true });
  function create<K extends keyof Replicants>(key: K) {
    return nodecg.Replicant<Replicants[K]>(key, { defaultValue: structuredClone(defaults[key]),
      persistent: !['connectionStatus', 'currentAlert', 'eventLog', 'credentialStatus', 'givebutterCredentialStatus'].includes(key) });
  }
  const reps = {
    campaign: create('campaign'), settings: create('settings'), connectionStatus: create('connectionStatus'),
    campaignHistory: create('campaignHistory'),
    recentDonations: create('recentDonations'), currentAlert: create('currentAlert'), eventLog: create('eventLog'),
    donationLedger: create('donationLedger'), mockState: create('mockState'),
    credentialStatus: create('credentialStatus'),
    givebutterCredentialStatus: create('givebutterCredentialStatus'), alertSound: create('alertSound'),
    overlayAppearance: create('overlayAppearance'),
    donationHistory: create('donationHistory'), donationControl: create('donationControl'),
  };
  const store: StateStore = {
    get: <K extends keyof Replicants>(key: K): Replicants[K] => JSON.parse(JSON.stringify(reps[key].value ?? defaults[key])) as Replicants[K],
    set: <K extends keyof Replicants>(key: K, value: Replicants[K]) => {
      // Runtime schemas are the same source used to generate NodeCG JSON schemas.
      schemas[key].parse(value);
      // NodeCG takes ownership of assigned objects. A donation appears in history
      // and currentAlert, so each Replicant must receive an independent copy.
      (reps[key] as NodeCG.ServerReplicant<Replicants[K]>).value = JSON.parse(JSON.stringify(value)) as Replicants[K];
    },
  };
  const log = (message: string, error = false) => {
    nodecg.log[error ? 'warn' : 'info'](message);
    store.set('eventLog', [{ id: randomUUID(), timestamp: new Date().toISOString(), message,
      level: error ? 'error' as const : 'info' as const }, ...store.get('eventLog')].slice(0, 50));
  };
  store.set('settings', settingsSchema.parse(store.get('settings')));
  store.set('overlayAppearance', resolveOverlayAppearance(store.get('overlayAppearance')));
  store.set('campaign', { ...store.get('campaign'), connected: false });
  store.set('currentAlert', structuredClone(defaults.currentAlert));
  store.set('connectionStatus', { ...defaults.connectionStatus, provider: store.get('settings').provider });
  const credentials = new CredentialStore(resolve(process.env.NODECG_ROOT ?? process.cwd(), '.secrets'), () => ({
    clientId: process.env.GOFUNDME_CLIENT_ID, clientSecret: process.env.GOFUNDME_CLIENT_SECRET,
  }));
  store.set('credentialStatus', credentials.status());
  const givebutterCredentials = new GivebutterCredentialStore(resolve(process.env.NODECG_ROOT ?? process.cwd(), '.secrets'), () => ({ apiKey: process.env.GIVEBUTTER_API_KEY }));
  store.set('givebutterCredentialStatus', givebutterCredentials.status());
  const service = new CampaignService(store, log, () => credentials.get(), () => givebutterCredentials.get().apiKey);
  // Serialize operator changes; polling itself coalesces concurrent refreshes.
  let commandTail: Promise<void> = Promise.resolve();
  const serialize = (action: () => Promise<void>) => {
    const pending = commandTail.then(action, action);
    commandTail = pending.catch(() => {});
    return pending;
  };
  mountCredentialRoutes(nodecg, { credentials, serialize, updated: async () => {
    store.set('credentialStatus', credentials.status());
    // Existing tokens must not continue polling after credentials are replaced.
    if (store.get('connectionStatus').provider === 'gofundme-pro') await service.disconnect(false);
    log('GoFundMe Pro credential configuration updated · connect to use the current credentials');
  } });
  mountSecretRoutes(nodecg, { path: `/${BUNDLE}/givebutter-credentials`, schema: givebutterCredentialsSchema,
    invalidMessage: 'Enter your Givebutter API key on a single line (maximum 4096 characters).',
    credentials: givebutterCredentials, serialize, updated: async () => {
      store.set('givebutterCredentialStatus', givebutterCredentials.status());
      if (store.get('connectionStatus').provider === 'givebutter') await service.disconnect(false);
      log('Givebutter API key configuration updated · connect to use the current key');
    } });
  mountAlertSoundRoutes(nodecg, { store, serialize, files: new AlertSoundFiles(resolve(process.env.NODECG_ROOT ?? process.cwd(), 'assets', BUNDLE, 'alert-sound')) });
  function command<K extends keyof Commands>(name: K, schema: z.ZodType<Commands[K]>, action: (data: Commands[K]) => unknown,
    invalidMessage = 'Check the entered values. Polling must be 10–300 seconds, alerts 2–30 seconds, and amounts must be positive numbers.') {
    nodecg.listenFor(name, (payload: unknown, ack) => {
      const execute = async () => {
        try {
          const parsed = schema.safeParse(payload);
          if (!parsed.success) throw new ProviderError(invalidMessage);
          await action(parsed.data);
          if (ack && !ack.handled) ack(null);
        } catch (error: unknown) {
          if (!(error instanceof ProviderError)) nodecg.log.error('Internal command failure:', error);
          const message = publicError(error); log(message, true);
          if (ack && !ack.handled) ack(new Error(message));
        }
      };
      void serialize(execute);
    });
  }
  const noData = z.undefined();
  command('connect', settingsSchema, (data) => service.connect(data));
  command('refresh', noData, () => service.refresh());
  command('disconnect', noData, () => service.disconnect());
  command('saveSettings', settingsSchema.pick({ pollingIntervalSeconds: true, alertDurationSeconds: true }), (data) => service.saveSettings(data));
  command('testAlert', noData, () => service.testAlert());
  command('resendDonation', z.object({ donationId: z.string().min(1).max(4096) }).strict(), (data) => service.resendDonation(data));
  command('sendDonation', z.object({ entryId: z.string().uuid() }).strict(), (data) => service.sendDonation(data));
  command('editDonation', editDonationSchema, (data) => service.editDonation(data),
    'Enter a donor name of 1–200 characters and a donation message of up to 2,000 characters.');
  command('resetDonation', z.object({ entryId: z.string().uuid() }).strict(), (data) => service.resetDonation(data));
  command('setManualAlertControl', schemas.donationControl, (data) => service.setManualAlertControl(data));
  command('saveAlertSound', alertSoundSchema.pick({ enabled: true, volume: true }), (data) => {
    store.set('alertSound', { ...store.get('alertSound'), ...data }); log('Donation alert sound settings saved');
  });
  command('saveOverlayAppearance', overlayAppearanceSchema, (data) => {
    const appearance = resolveOverlayAppearance(data, store.get('overlayAppearance'));
    const { alertAnimation, thermometerAnimation } = appearance;
    store.set('overlayAppearance', appearance);
    log(`Overlay appearance saved · ${data.theme === 'bwf' ? 'BWF' : data.theme === 'quest' ? 'Quest' : 'Custom'} · alerts: ${overlayAnimationNames[alertAnimation]} · thermometer: ${overlayAnimationNames[thermometerAnimation]}`);
  }, 'Use whole-number animation times from 0–10,000 ms, border sizes from 0–10 px, valid icon choices, and six-digit hex colors such as #B5F36D.');
  command('clearQueue', noData, () => { service.alerts.clear(); log('Pending alert queue cleared'); });
  command('dismissAlert', noData, () => service.alerts.dismiss());
  command('editMock', mockEditSchema, (data) => service.editMock(data));
  command('addMockDonation', mockDonationSchema, (data) => service.addMockDonation(data));
  command('resetMock', noData, () => service.resetMock());
  log('DONATECONTROL ready · connect to establish a fresh baseline');
}
