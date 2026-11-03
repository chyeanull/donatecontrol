import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CredentialStore } from '../src/extension/services/credentialStore';

const directories: string[] = [];
const first = { clientId: 'fixture-client-one', clientSecret: 'fixture-secret-one' };
const second = { clientId: 'fixture-client-two', clientSecret: 'fixture-secret-two' };
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'gofundme-credentials-test-'));
  directories.push(path); return path;
}
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('server-only credentials', () => {
  it('persists with private permissions and restores after restart without publishing values', async () => {
    const path = await directory();
    const store = new CredentialStore(path, () => ({}));
    expect(store.status()).toEqual({ configured: false, source: 'none', saved: false, storageError: false });
    await store.save(first);
    expect(store.get()).toEqual(first);
    expect(store.status()).toEqual({ configured: true, source: 'dashboard', saved: true, storageError: false });
    expect(JSON.stringify(store.status())).not.toContain(first.clientId);
    expect(JSON.stringify(store.status())).not.toContain(first.clientSecret);
    expect(new CredentialStore(path, () => ({})).get()).toEqual(first);
    if (process.platform !== 'win32') {
      expect((await stat(path)).mode & 0o777).toBe(0o700);
      expect((await stat(join(path, 'gofundme-pro.json'))).mode & 0o777).toBe(0o600);
    }
  });
  it('replaces both values together, prefers saved credentials, and restores the environment when removed', async () => {
    const path = await directory();
    const store = new CredentialStore(path, () => first);
    expect(store.get()).toEqual(first); expect(store.status().source).toBe('environment');
    await store.save(second); expect(store.get()).toEqual(second);
    await store.save(first); expect(new CredentialStore(path, () => second).get()).toEqual(first);
    await store.remove(); expect(store.get()).toEqual(first); expect(store.status().saved).toBe(false);
    expect(new CredentialStore(path, () => second).get()).toEqual(second);
    await expect(readFile(join(path, 'gofundme-pro.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects incomplete or multiline input without erasing the existing pair or including entered values in errors', async () => {
    const path = await directory();
    const store = new CredentialStore(path, () => ({}));
    await store.save(first);
    for (const invalid of [{ ...second, clientSecret: '' }, { ...second, clientId: '\n' }, { ...second, clientSecret: 'private\nvalue' }]) {
      try { await store.save(invalid); expect.fail('Should reject invalid input'); }
      catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        expect(String(error)).not.toContain(second.clientId);
        expect(String(error)).not.toContain('private');
      }
      expect(store.get()).toEqual(first);
    }
    expect(new CredentialStore(path, () => ({})).get()).toEqual(first);
  });
  it('reports corrupted storage without exposing it or silently selecting a different account', async () => {
    const path = await directory();
    await writeFile(join(path, 'gofundme-pro.json'), '{"clientSecret":"do-not-display-this"');
    const store = new CredentialStore(path, () => first);
    expect(store.get()).toEqual({});
    expect(store.status()).toEqual({ configured: false, source: 'none', saved: true, storageError: true });
    expect(JSON.stringify(store.status())).not.toContain('do-not-display-this');
    await store.save(second);
    expect(store.status().storageError).toBe(false); expect(store.get()).toEqual(second);
  });
  it('keeps a valid in-memory pair when a filesystem write fails and gives a safe error', async () => {
    const parent = await directory();
    const path = join(parent, '.secrets');
    const store = new CredentialStore(path, () => first);
    await writeFile(path, 'not a directory');
    await expect(store.save(second)).rejects.toThrow('Credentials could not be saved');
    expect(store.get()).toEqual(first); expect(store.status().source).toBe('environment');
  });
});
