import type { AppConfig, SessionRecord } from './types';

/**
 * IPC channel names and the request/response contract for each.
 *
 * Kept in one place so the main-process handlers, the preload bridge and the
 * renderer's typed `window.api` cannot drift apart.
 */
export const IPC = {
  getConfig: 'app:get-config',
  listSessions: 'sessions:list',
  saveSession: 'sessions:save',
  deleteAllSessions: 'sessions:delete-all',
  openExternal: 'shell:open-external',
} as const;

export interface RendererApi {
  readonly getConfig: () => Promise<AppConfig>;
  readonly listSessions: () => Promise<SessionRecord[]>;
  readonly saveSession: (session: SessionRecord) => Promise<void>;
  readonly deleteAllSessions: () => Promise<void>;
  /** Opens an https:// URL in the system browser. Anything else is rejected. */
  readonly openExternal: (url: string) => Promise<void>;
}
