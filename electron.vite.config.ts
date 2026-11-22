import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
  },
  preload: {
    // The preload runs sandboxed, where `require()` of arbitrary packages is
    // unavailable, so the SDK's preload bridge is bundled in rather than
    // externalised. It only depends on `electron`, which stays external.
    plugins: [externalizeDepsPlugin({ exclude: ['@smartspectra/node-sdk'] })],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        output: {
          // The SmartSpectra preload bridge is CommonJS; keep the preload bundle CJS too.
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: { alias: sharedAlias },
  },
});
