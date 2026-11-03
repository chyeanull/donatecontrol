import type NodeCG from 'nodecg/types';
import { BUNDLE } from '../shared/models';
import { credentialsSchema, type CredentialStore } from './services/credentialStore';
import { publicError } from './providers/FundraisingProvider';
import type { z } from 'zod';
import type { CredentialStatus } from '../shared/models';

interface CredentialRouteOptions {
  credentials: CredentialStore;
  serialize: (action: () => Promise<void>) => Promise<void>;
  updated: () => Promise<void>;
}

export function mountCredentialRoutes(nodecg: NodeCG.ServerAPI, options: CredentialRouteOptions) {
  mountSecretRoutes(nodecg, { ...options, path: `/${BUNDLE}/credentials`, schema: credentialsSchema,
    invalidMessage: 'Enter both a client ID and client secret, each on a single line (maximum 4096 characters).' });
}

export function mountSecretRoutes<T>(nodecg: NodeCG.ServerAPI, options: {
  path: string; schema: z.ZodType<T>; invalidMessage: string;
  credentials: { save: (data: T) => Promise<void>; remove: () => Promise<void>; status: () => CredentialStatus };
  serialize: (action: () => Promise<void>) => Promise<void>; updated: () => Promise<void>;
}) {
  const router = nodecg.Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(nodecg.util.authCheck);
  router.use((req, res, next) => {
    // A custom header prevents cross-site forms; same-origin checks also protect
    // localhost installations where NodeCG login is intentionally disabled.
    const origin = req.get('Origin');
    let sameOrigin = false;
    try {
      const parsed = new URL(origin ?? '');
      sameOrigin = ['http:', 'https:'].includes(parsed.protocol) && parsed.host === req.get('Host');
    } catch { /* Missing or malformed origins are rejected. */ }
    if (req.get('X-GoFundMe-Control') !== 'credentials' || !sameOrigin || req.get('Sec-Fetch-Site') === 'cross-site') {
      res.status(403).json({ error: 'Manage credentials from this NodeCG control panel.' }); return;
    }
    next();
  });

  router.post('/', (req, res) => {
    if (!req.is('application/json')) { res.status(415).json({ error: 'Credentials must be sent as JSON.' }); return; }
    const parsed = options.schema.safeParse(req.body as unknown);
    if (!parsed.success) { res.status(400).json({ error: options.invalidMessage }); return; }
    void options.serialize(async () => {
      await options.credentials.save(parsed.data);
      await options.updated();
    }).then(() => res.json(options.credentials.status())).catch((error: unknown) => {
      // Unlike NodeCG messages, this endpoint never broadcasts request bodies.
      // Do not log the request or error object, which might contain credentials.
      res.status(500).json({ error: publicError(error) });
    });
  });
  router.delete('/', (_req, res) => {
    void options.serialize(async () => {
      await options.credentials.remove();
      await options.updated();
    }).then(() => res.json(options.credentials.status())).catch((error: unknown) => {
      res.status(500).json({ error: publicError(error) });
    });
  });
  nodecg.mount(options.path, router);
}
