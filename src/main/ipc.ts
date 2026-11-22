import { ipcMain, shell } from 'electron';

import { IPC } from '@shared/ipc';
import type { AppConfig, SessionRecord } from '@shared/types';

import type { SessionStore } from './sessionStore';

interface IpcDependencies {
  readonly config: AppConfig;
  readonly sessions: SessionStore;
}

/** Registers every main-process IPC handler the renderer may call. */
export function registerIpcHandlers({ config, sessions }: IpcDependencies): void {
  ipcMain.handle(IPC.getConfig, (): AppConfig => config);

  ipcMain.handle(IPC.listSessions, () => sessions.list());

  ipcMain.handle(IPC.saveSession, (_event, session: unknown) => {
    if (!isSessionRecord(session)) {
      throw new TypeError('saveSession: payload is not a SessionRecord');
    }
    return sessions.save(session);
  });

  ipcMain.handle(IPC.deleteAllSessions, () => sessions.deleteAll());

  ipcMain.handle(IPC.openExternal, async (_event, url: unknown) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      throw new TypeError('openExternal: only https:// URLs are allowed');
    }
    await shell.openExternal(url);
  });
}

/** Shallow structural check; enough to reject malformed IPC payloads. */
function isSessionRecord(value: unknown): value is SessionRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.startedAtMs === 'number' &&
    typeof record.finishedAtMs === 'number' &&
    typeof record.completedAt === 'string' &&
    Array.isArray(record.answers) &&
    Array.isArray(record.nudges)
  );
}
