import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const runBuild = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Build failed')));
});
let server;
let busy = false;
let dirty = false;
let closing = false;
async function rebuild() {
  dirty = true;
  if (busy || closing) return;
  busy = true;
  while (dirty && !closing) {
    dirty = false;
    await delay(150);
    if (server) {
      const old = server;
      server = undefined;
      const stopped = new Promise((resolve) => old.once('exit', resolve));
      old.kill('SIGTERM');
      await stopped;
    }
    try {
      await runBuild();
      if (!closing) server = spawn(process.execPath, ['node_modules/nodecg/cli.mjs', 'start'], { stdio: 'inherit' });
    } catch { console.error('Fix the build error; saving a source file will retry.'); }
  }
  busy = false;
}
const watcher = watch('src', { recursive: true }, () => void rebuild());
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  closing = true; watcher.close(); server?.kill(signal); process.exit(0);
});
await rebuild();
