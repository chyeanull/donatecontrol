import type NodeCG from 'nodecg/types';
import { BUNDLE } from '../shared/models';
import type { StateStore } from './services/campaignService';
import { AlertSoundFiles, MAX_SOUND_BYTES } from './services/alertSoundFiles';
import { publicError } from './providers/FundraisingProvider';

export function mountAlertSoundRoutes(nodecg: NodeCG.ServerAPI, options: {
  files: AlertSoundFiles; store: StateStore; serialize: (action: () => Promise<void>) => Promise<void>;
}) {
  const router = nodecg.Router();
  router.use(nodecg.util.authCheck);
  router.get('/file/:file', (req, res) => {
    if (req.params.file !== options.store.get('alertSound').file) { res.sendStatus(404); return; }
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(options.files.path(req.params.file), (error) => { if (error && !res.headersSent) res.sendStatus(404); });
  });
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    let sameOrigin = false;
    try { const origin = new URL(req.get('Origin') ?? ''); sameOrigin = ['http:', 'https:'].includes(origin.protocol) && origin.host === req.get('Host'); } catch { /* Reject invalid origins. */ }
    if (!sameOrigin || req.get('X-GoFundMe-Control') !== 'sound' || req.get('Sec-Fetch-Site') === 'cross-site') {
      res.status(403).json({ error: 'Manage sounds from this NodeCG control panel.' }); return;
    }
    next();
  });
  router.post('/', (req, res) => {
    if (!req.is('application/octet-stream')) { res.status(415).json({ error: 'Upload the audio file from the control panel.' }); return; }
    let filename: string;
    try { filename = decodeURIComponent(req.get('X-File-Name') ?? ''); } catch { res.status(400).json({ error: 'Invalid filename.' }); return; }
    if (Number(req.get('Content-Length')) > MAX_SOUND_BYTES) { res.status(413).json({ error: 'Sound files must be 10 MB or smaller.' }); req.resume(); return; }
    const chunks: Buffer[] = []; let size = 0; let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_SOUND_BYTES) { tooLarge = true; chunks.length = 0; }
      else if (!tooLarge) chunks.push(chunk);
    });
    req.on('error', () => { if (!res.headersSent) res.status(400).json({ error: 'The upload was interrupted. Try again.' }); });
    req.on('end', () => {
      if (tooLarge) { res.status(413).json({ error: 'Sound files must be 10 MB or smaller.' }); return; }
      void options.serialize(async () => {
        const uploaded = await options.files.save(filename, Buffer.concat(chunks));
        const previous = options.store.get('alertSound');
        try { options.store.set('alertSound', { ...previous, ...uploaded, enabled: true }); }
        catch (error) { await options.files.remove(uploaded.file); throw error; }
        await options.files.remove(previous.file);
      }).then(() => res.json(options.store.get('alertSound'))).catch((error: unknown) => res.status(400).json({ error: publicError(error) }));
    });
  });
  router.delete('/', (_req, res) => {
    void options.serialize(async () => {
      const previous = options.store.get('alertSound');
      options.store.set('alertSound', { ...previous, file: null, name: '', enabled: false });
      await options.files.remove(previous.file);
    }).then(() => res.json(options.store.get('alertSound'))).catch((error: unknown) => res.status(500).json({ error: publicError(error) }));
  });
  nodecg.mount(`/${BUNDLE}/alert-sound`, router);
}
