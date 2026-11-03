import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  root: 'src/client', base: '/bundles/gofundme-live/',
  build: {
    outDir: '../../bundles/gofundme-live', emptyOutDir: false, assetsDir: 'graphics/assets',
    rollupOptions: { input: {
      control: resolve('src/client/dashboard/control.html'),
      overlays: resolve('src/client/dashboard/overlays.html'),
      alerts: resolve('src/client/dashboard/alerts.html'),
      donations: resolve('src/client/dashboard/donations.html'),
      thermometer: resolve('src/client/graphics/thermometer.html'),
      alert: resolve('src/client/graphics/alert.html'),
    } },
  },
});
