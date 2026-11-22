import { contextBridge, ipcRenderer } from 'electron';

import { IPC, type RendererApi } from '@shared/ipc';
import type { SessionRecord } from '@shared/types';

// Installs `window.__smartspectraBridge`, the MessagePort bridge the renderer
// SDK (`@smartspectra/node-sdk/renderer`) talks to. Must run in preload.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('@smartspectra/node-sdk/preload');

const api: RendererApi = {
  getConfig: () => ipcRenderer.invoke(IPC.getConfig),
  listSessions: () => ipcRenderer.invoke(IPC.listSessions),
  saveSession: (session: SessionRecord) => ipcRenderer.invoke(IPC.saveSession, session),
  deleteAllSessions: () => ipcRenderer.invoke(IPC.deleteAllSessions),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, url),
};

contextBridge.exposeInMainWorld('api', api);
