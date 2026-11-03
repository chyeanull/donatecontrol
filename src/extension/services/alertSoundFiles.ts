import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ProviderError } from '../providers/FundraisingProvider';

export const MAX_SOUND_BYTES = 10 * 1024 * 1024;
export class AlertSoundFiles {
  constructor(private readonly directory: string) {}
  path(file: string) {
    if (!/^[a-f0-9-]{36}\.(mp3|wav|ogg)$/.test(file)) throw new ProviderError('Invalid sound file.');
    return join(this.directory, file);
  }
  async save(name: string, data: Buffer) {
    if (!data.length || data.length > MAX_SOUND_BYTES) throw new ProviderError('Choose an audio file between 1 byte and 10 MB.');
    const ext = extname(name).toLowerCase();
    const valid = ext === '.wav' ? data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WAVE'
      : ext === '.ogg' ? data.toString('ascii', 0, 4) === 'OggS'
      : ext === '.mp3' && (data.toString('ascii', 0, 3) === 'ID3' || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0));
    if (!valid) throw new ProviderError('Choose a valid MP3, WAV, or OGG audio file.');
    const file = `${randomUUID()}${ext}`;
    try { await mkdir(this.directory, { recursive: true }); await writeFile(this.path(file), data, { flag: 'wx', mode: 0o600 }); }
    catch { throw new ProviderError('The sound could not be saved. Check permissions on the server assets directory.'); }
    return { file, name: basename(name.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) };
  }
  async remove(file: string | null) {
    if (!file) return;
    await unlink(this.path(file)).catch(() => {});
  }
}
