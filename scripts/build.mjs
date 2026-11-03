import { build as viteBuild } from 'vite';
import { build as esbuild } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { z } from 'zod';

const require = createRequire(import.meta.url);
await esbuild({ entryPoints: ['src/shared/dashboard.ts'], outfile: '.build/dashboard.cjs', bundle: true, platform: 'node', format: 'cjs' });
const { dashboardPages } = require('../.build/dashboard.cjs');
const manifestPath = 'bundles/gofundme-live/package.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.nodecg.dashboardPanels = dashboardPages.map((page) => ({
  name: page.panel, title: `${page.order} · ${page.label}`, file: `${page.panel}.html`, fullbleed: true,
}));
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
await esbuild({ entryPoints: ['src/shared/models.ts'], outfile: '.build/models.cjs', bundle: true, platform: 'node', format: 'cjs', packages: 'external' });
const { schemas, defaults } = require('../.build/models.cjs');
await mkdir('bundles/gofundme-live/schemas', { recursive: true });
for (const [name, schema] of Object.entries(schemas)) {
  const json = z.toJSONSchema(schema, { target: 'draft-7' });
  json.default = defaults[name];
  await writeFile(`bundles/gofundme-live/schemas/${name}.json`, JSON.stringify(json, null, 2) + '\n');
}
await esbuild({ entryPoints: ['src/extension/index.ts'], outfile: 'bundles/gofundme-live/extension/main.cjs', bundle: true, platform: 'node', target: 'node22', format: 'cjs', packages: 'external', sourcemap: true });
await writeFile('bundles/gofundme-live/extension/index.js', "module.exports = require('./main.cjs').default;\n");
await viteBuild();
