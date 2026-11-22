import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { app } from 'electron';

import type { AppConfig } from '@shared/types';

const API_KEY_ENV = 'SMARTSPECTRA_API_KEY';

/**
 * Loads configuration from the environment.
 *
 * In development the project-root `.env` is read. In a packaged build only
 * the real process environment is consulted, so a key is never baked into
 * the installer. The key is handed to the renderer over IPC at runtime and
 * is never written to disk by this app.
 */
export function loadAppConfig(): AppConfig {
  if (!app.isPackaged) {
    const envPath = resolve(app.getAppPath(), '.env');
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, quiet: true });
    }
  }

  const key = process.env[API_KEY_ENV]?.trim();

  return {
    smartSpectraApiKey: key !== undefined && key.length > 0 ? key : null,
    appVersion: app.getVersion(),
  };
}
