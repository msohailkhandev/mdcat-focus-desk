import { join } from 'node:path';

import { bindSmartSpectraIpc } from '@smartspectra/node-sdk/main';
import { BrowserWindow, app, session, shell } from 'electron';

// Prioritise hardware-accelerated video decoding so the SDK receives frames
// at the camera's native rate instead of falling behind in software decode.
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

import { loadAppConfig } from './config';
import { registerIpcHandlers } from './ipc';
import { SessionStore } from './sessionStore';

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;

/**
 * Content Security Policy for the renderer.
 *
 * `blob:` in `worker-src` is required by the SmartSpectra renderer SDK, which
 * runs its frame-extraction worker from a blob URL. Nothing else is allowed
 * to load from the network: the only outbound connection this app makes is
 * the SDK's own authentication with Presage, which happens in the main
 * process.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'" + (DEV_SERVER_URL ? " 'unsafe-inline'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self'" + (DEV_SERVER_URL ? ' ws: http://localhost:*' : ''),
].join('; ');

function isOwnPage(url: string): boolean {
  if (url.startsWith('file://')) {
    return true;
  }
  return DEV_SERVER_URL !== undefined && url.startsWith(DEV_SERVER_URL);
}

function configureSession(): void {
  // Grant only the camera, and only to our own bundled page. Everything else
  // (microphone, geolocation, notifications…) is denied outright.
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl = details.requestingUrl || webContents.getURL();
      const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
      const isCameraOnly =
        permission === 'media' &&
        isOwnPage(requestingUrl) &&
        (mediaTypes === undefined || mediaTypes.every((t) => t === 'video'));
      callback(isCameraOnly);
    },
  );

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
      },
    });
  });
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1410',
    title: 'MDCAT Focus Desk',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Wires the SDK's MessagePort channel for this window; teardown is automatic on close.
  bindSmartSpectraIpc(window, {
    logger: (level, message) => {
      if (level === 'error') {
        console.error(`[smartspectra] ${message}`);
      } else if (level === 'warn') {
        console.warn(`[smartspectra] ${message}`);
      }
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  // Any navigation away from our page, or any new window, opens externally instead.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isOwnPage(url)) {
      event.preventDefault();
    }
  });

  if (DEV_SERVER_URL) {
    void window.loadURL(DEV_SERVER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}

void app.whenReady().then(() => {
  const config = loadAppConfig();
  const sessions = SessionStore.inDirectory(app.getPath('userData'));

  configureSession();
  registerIpcHandlers({ config, sessions });
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
