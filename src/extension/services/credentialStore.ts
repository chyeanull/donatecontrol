import { readFileSync } from 'node:fs';
import { chmod, mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CredentialStatus } from '../../shared/models';
import { ProviderError } from '../providers/FundraisingProvider';

const credentialValue = z.string().trim().min(1).max(4096).regex(/^[^\r\n\0]+$/);
export const credentialsSchema = z.object({ clientId: credentialValue, clientSecret: credentialValue }).strict();
export type ProCredentials = z.infer<typeof credentialsSchema>;
export const givebutterCredentialsSchema = z.object({ apiKey: credentialValue }).strict();
export type GivebutterCredentials = z.infer<typeof givebutterCredentialsSchema>;

class SecretStore<T extends object> {
  private saved?: T;
  private unreadable = false;
  private readonly file: string;

  constructor(directory: string, filename: string, private readonly schema: z.ZodType<T>, private readonly environment: () => Partial<T>) {
    this.file = join(directory, filename);
    try {
      const parsed = schema.safeParse(JSON.parse(readFileSync(this.file, 'utf8')));
      if (parsed.success) this.saved = parsed.data;
      else this.unreadable = true;
    } catch (error: unknown) {
      // Never include file contents, parser errors, or entered values in public errors.
      this.unreadable = !(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
    }
  }

  get(): Partial<T> {
    if (this.unreadable) return {};
    if (this.saved) return { ...this.saved };
    const parsed = this.schema.safeParse(this.environment());
    return parsed.success ? parsed.data : {};
  }

  status(): CredentialStatus {
    const configured = this.schema.safeParse(this.get()).success;
    return { configured, source: this.saved ? 'dashboard' : configured ? 'environment' : 'none',
      saved: Boolean(this.saved) || this.unreadable, storageError: this.unreadable };
  }

  async save(input: T): Promise<void> {
    const parsed = this.schema.safeParse(input);
    if (!parsed.success) throw new ProviderError('Enter all required credentials, each on a single line.');
    const directory = dirname(this.file);
    const temporary = join(directory, `.credentials-${randomUUID()}.tmp`);
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o700);
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(JSON.stringify(parsed.data) + '\n'); await file.sync(); }
      finally { await file.close(); }
      await rename(temporary, this.file);
      this.saved = parsed.data;
      this.unreadable = false;
    } catch {
      await unlink(temporary).catch(() => {});
      throw new ProviderError('Credentials could not be saved. Check that NodeCG can write to its .secrets directory, then try again.');
    }
  }

  async remove(): Promise<void> {
    try { await unlink(this.file); }
    catch (error: unknown) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw new ProviderError('Saved credentials could not be removed. Check permissions on the server .secrets directory.');
      }
    }
    this.saved = undefined;
    this.unreadable = false;
  }
}
export class CredentialStore extends SecretStore<ProCredentials> {
  constructor(directory: string, environment: () => Partial<ProCredentials>) {
    super(directory, 'gofundme-pro.json', credentialsSchema, environment);
  }
}
export class GivebutterCredentialStore extends SecretStore<GivebutterCredentials> {
  constructor(directory: string, environment: () => Partial<GivebutterCredentials>) {
    super(directory, 'givebutter.json', givebutterCredentialsSchema, environment);
  }
}
