import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlertSoundFiles, MAX_SOUND_BYTES } from '../src/extension/services/alertSoundFiles';
import { CredentialStore, GivebutterCredentialStore } from '../src/extension/services/credentialStore';

const directories: string[] = [];
async function directory() { const value = await mkdtemp(join(tmpdir(), 'alert-sound-test-')); directories.push(value); return value; }
afterEach(async () => { await Promise.all(directories.splice(0).map((value) => rm(value, { recursive: true, force: true }))); });
describe('alert sound storage', () => {
  it('stores supported files with generated names, sanitizes display names and removes old files', async () => {
    const files = new AlertSoundFiles(await directory());
    for (const [name, bytes] of [['C:\\sounds\\ding.WAV', 'RIFF1234WAVEdata'], ['../ding.mp3', 'ID3fixture'], ['ding.ogg', 'OggSfixture']]) {
      const uploaded = await files.save(name, Buffer.from(bytes));
      expect(uploaded.name).toMatch(/^ding\./); expect(uploaded.file).not.toContain('ding');
      expect(await readFile(files.path(uploaded.file), 'utf8')).toBe(bytes);
      await files.remove(uploaded.file);
      await expect(readFile(files.path(uploaded.file))).rejects.toMatchObject({ code: 'ENOENT' });
    }
    expect(() => files.path('../../secret.mp3')).toThrow('Invalid');
  });
  it('rejects oversized, empty, unsupported and incorrectly labeled uploads', async () => {
    const files = new AlertSoundFiles(await directory());
    for (const [name, data] of [['sound.wav', Buffer.alloc(0)], ['sound.mp3', Buffer.alloc(MAX_SOUND_BYTES + 1)], ['script.html', Buffer.from('ID3')], ['sound.wav', Buffer.from('not audio')]] as const) {
      await expect(files.save(name, data)).rejects.toThrow();
    }
  });
});
describe('Givebutter credential isolation', () => {
  it('persists privately, reports only status, and does not change Pro credentials', async () => {
    const path = await directory();
    const pro = new CredentialStore(path, () => ({})); const store = new GivebutterCredentialStore(path, () => ({ apiKey: 'environment-key' }));
    await pro.save({ clientId: 'pro-id', clientSecret: 'pro-secret' });
    await store.save({ apiKey: 'fixture-givebutter-key' });
    expect(new GivebutterCredentialStore(path, () => ({})).get()).toEqual({ apiKey: 'fixture-givebutter-key' });
    expect(JSON.stringify(store.status())).not.toContain('key');
    await expect(store.save({ apiKey: 'bad\nkey' })).rejects.toThrow();
    expect(store.get().apiKey).toBe('fixture-givebutter-key');
    await store.remove(); expect(store.get().apiKey).toBe('environment-key');
    expect(new CredentialStore(path, () => ({})).get()).toEqual({ clientId: 'pro-id', clientSecret: 'pro-secret' });
  });
});
