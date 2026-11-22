import type { RendererApi } from '@shared/ipc';

declare global {
  interface Window {
    /** Typed bridge to the main process, exposed by `src/preload/index.ts`. */
    readonly api: RendererApi;
  }
}

export {};
