import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { SessionRecord } from '@shared/types';

interface StoreFile {
  readonly version: 1;
  readonly sessions: SessionRecord[];
}

const EMPTY: StoreFile = { version: 1, sessions: [] };

/**
 * Local-only persistence for completed sessions.
 *
 * Sessions are stored as a single JSON file in the OS user-data directory.
 * Writes are atomic (write to a temp file, then rename) so a crash mid-write
 * never corrupts the student's history. No network, no sync, no telemetry.
 */
export class SessionStore {
  public constructor(private readonly filePath: string) {}

  public static inDirectory(userDataDir: string): SessionStore {
    return new SessionStore(join(userDataDir, 'sessions.json'));
  }

  public async list(): Promise<SessionRecord[]> {
    const store = await this.read();
    return [...store.sessions].sort((a, b) => b.startedAtMs - a.startedAtMs);
  }

  public async save(session: SessionRecord): Promise<void> {
    const store = await this.read();
    const sessions = store.sessions.filter((s) => s.id !== session.id);
    sessions.push(session);
    await this.write({ version: 1, sessions });
  }

  /** Permanently deletes every stored session. */
  public async deleteAll(): Promise<void> {
    await rm(this.filePath, { force: true });
  }

  private async read(): Promise<StoreFile> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (isNotFound(error)) {
        return EMPTY;
      }
      throw error;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isStoreFile(parsed)) {
      throw new Error(`Unrecognised session store format at ${this.filePath}`);
    }
    return parsed;
  }

  private async write(store: StoreFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf8');
    await rename(tmpPath, this.filePath);
  }
}

function isStoreFile(value: unknown): value is StoreFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { sessions?: unknown }).sessions)
  );
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: unknown }).code === 'ENOENT';
}
