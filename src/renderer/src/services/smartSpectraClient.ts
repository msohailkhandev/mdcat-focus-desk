import {
  MetricType,
  SmartSpectraSDK,
  ValidationCode,
  breathingMetrics,
  cardioMetrics,
  type SmartSpectraErrorCodeValue,
  type ValidationCodeValue,
} from '@smartspectra/node-sdk/renderer';
import { decodeMetrics } from '@smartspectra/node-sdk/messages';

import { toVitalsSample } from '@shared/composure/metricsAdapter';
import type { VitalsSample } from '@shared/types';

export type SignalStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error';

export interface SignalError {
  readonly code: SmartSpectraErrorCodeValue | 'camera';
  readonly message: string;
  readonly retryable: boolean;
}

/** Live diagnostics, updated about once per second. Shown in the debug panel. */
export interface SignalStats {
  /** Frames the SDK accepted in the last second. */
  readonly fps: number;
  /** Frames the SDK rejected (dropped) in the last second. */
  readonly droppedFps: number;
  /** Metrics packets received in the last second. */
  readonly packetsPerSecond: number;
  readonly validationCode: ValidationCodeValue | null;
  readonly validationHint: string;
  readonly lastSample: VitalsSample | null;
  readonly streamSettings: {
    width?: number | undefined;
    height?: number | undefined;
    frameRate?: number | undefined;
  } | null;
  /** Result of the exposure lock attempt (see `lockExposure`). */
  readonly exposureLock: string;
  /** What the camera says it can do, from `getCapabilities()` (not all browsers fill this). */
  readonly cameraCapabilities: {
    maxFrameRate?: number | undefined;
    exposureModes?: readonly string[] | undefined;
    label?: string | undefined;
  } | null;
}

export interface SignalListeners {
  readonly onSample?: (sample: VitalsSample) => void;
  readonly onStream?: (stream: MediaStream) => void;
  readonly onValidation?: (ok: boolean, hint: string) => void;
  readonly onStatus?: (status: SignalStatus) => void;
  readonly onError?: (error: SignalError) => void;
  readonly onStats?: (stats: SignalStats) => void;
}

/**
 * Camera constraints, tried in order. The SDK needs >= 25 fps; 640x480 is
 * plenty for rPPG and keeps webcams at a steady 30 fps where 720p often
 * drops to 15-20 fps under low light. The strict variant forces the browser
 * to pick a >= 24 fps mode; if the camera can't promise that we fall back
 * to a best-effort request rather than failing outright.
 */
const VIDEO_CONSTRAINT_ATTEMPTS: readonly MediaTrackConstraints[] = [
  {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, min: 24 },
    facingMode: 'user',
  },
  { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: 'user' },
];

async function acquireCamera(): Promise<MediaStream> {
  let lastError: unknown;
  for (const video of VIDEO_CONSTRAINT_ATTEMPTS) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (error) {
      lastError = error;
      if (!(error instanceof DOMException && error.name === 'OverconstrainedError')) {
        throw error;
      }
    }
  }
  throw lastError;
}

/** Breathing + pulse + blink detection only (no landmarks/expressions, heavier, unused). */
const REQUESTED_METRICS: readonly number[] = [
  ...breathingMetrics,
  ...cardioMetrics,
  MetricType.BLINKING,
];

/**
 * Thin, app-specific wrapper around the SmartSpectra renderer SDK.
 *
 * - Owns the camera stream (acquired here, released in `stop()`), so a
 *   failed start never leaves a dangling camera or a half-initialised SDK.
 * - Requests exactly the metrics this app uses and turns SDK telemetry off.
 * - Tags every decoded packet with the latest validation state so no
 *   downstream code sees a reading the SDK itself considered unreliable.
 * - Counts frames and packets so the UI can show real throughput.
 */
export class SmartSpectraClient {
  private sdk: SmartSpectraSDK | null = null;
  private stream: MediaStream | null = null;
  private starting: Promise<void> | null = null;
  private status: SignalStatus = 'idle';

  private validationCode: ValidationCodeValue | null = null;
  private validationHint = '';
  private lastSample: VitalsSample | null = null;
  private framesSent = 0;
  private framesDropped = 0;
  private packets = 0;
  private statsTimer: number | null = null;
  private readonly exposureLock = 'auto (manual lock disabled)';

  public constructor(
    private readonly apiKey: string,
    private readonly listeners: SignalListeners,
  ) {}

  public get currentStatus(): SignalStatus {
    return this.status;
  }

  /** Idempotent: concurrent callers share the same in-flight start. */
  public start(): Promise<void> {
    if (this.sdk) {
      return Promise.resolve();
    }
    this.starting ??= this.doStart().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async doStart(): Promise<void> {
    this.setStatus('starting');

    let stream: MediaStream;
    try {
      stream = await acquireCamera();
    } catch (error) {
      const friendly = describeCameraError(error);
      this.setStatus('error');
      this.listeners.onError?.({ code: 'camera', message: friendly, retryable: true });
      throw new Error(friendly);
    }
    this.stream = stream;
    this.listeners.onStream?.(stream);

    const sdk = new SmartSpectraSDK({
      apiKey: this.apiKey,
      requestedMetrics: [...REQUESTED_METRICS],
      enableTelemetry: false,
    });
    sdk.useMediaStream(stream);

    sdk.on('validationStatus', (code, _ts, hint) => {
      this.validationCode = code;
      this.validationHint = hint;
      this.listeners.onValidation?.(code === ValidationCode.kOk, hint);
    });

    sdk.on('metrics', (buf) => {
      this.packets += 1;
      const metrics = decodeMetrics(buf);
      const sample = toVitalsSample(
        metrics,
        performance.now(),
        this.validationCode === ValidationCode.kOk,
      );
      this.lastSample = sample;
      this.listeners.onSample?.(sample);
    });

    sdk.on('frameSentThrough', (sent) => {
      if (sent) {
        this.framesSent += 1;
      } else {
        this.framesDropped += 1;
      }
    });

    sdk.on('error', (code, message, retryable) => {
      this.setStatus('error');
      this.listeners.onError?.({ code, message, retryable });
    });

    try {
      await sdk.start();
    } catch (error) {
      sdk.destroy();
      this.releaseStream();
      this.setStatus('error');
      throw error;
    }

    this.sdk = sdk;
    this.startStatsTimer();
    // NOTE: a manual-exposure lock was tried to hold 30fps, but on some
    // webcams (e.g. HP HD Camera) forcing manual exposure *lowers* the
    // delivered frame rate. Left on auto-exposure; use a camera that can
    // sustain >= 25fps and good front lighting instead.
    this.setStatus('running');
  }

  public async stop(): Promise<void> {
    if (this.starting) {
      await this.starting.catch(() => undefined);
    }
    const sdk = this.sdk;
    this.sdk = null;
    this.stopStatsTimer();
    try {
      if (sdk) {
        await sdk.stop();
      }
    } finally {
      sdk?.destroy();
      this.releaseStream();
      this.validationCode = null;
      this.validationHint = '';
      this.lastSample = null;
      this.setStatus('stopped');
    }
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.stream = null;
  }

  private startStatsTimer(): void {
    this.stopStatsTimer();
    this.statsTimer = window.setInterval(() => {
      const track = this.stream?.getVideoTracks()[0];
      const settings = track?.getSettings();
      const caps =
        track && typeof track.getCapabilities === 'function' ? track.getCapabilities() : undefined;
      this.listeners.onStats?.({
        exposureLock: this.exposureLock,
        cameraCapabilities: track
          ? {
              maxFrameRate: caps?.frameRate?.max,
              exposureModes: (caps as { exposureMode?: string[] } | undefined)?.exposureMode,
              label: track.label,
            }
          : null,
        fps: this.framesSent,
        droppedFps: this.framesDropped,
        packetsPerSecond: this.packets,
        validationCode: this.validationCode,
        validationHint: this.validationHint,
        lastSample: this.lastSample,
        streamSettings: settings
          ? { width: settings.width, height: settings.height, frameRate: settings.frameRate }
          : null,
      });
      this.framesSent = 0;
      this.framesDropped = 0;
      this.packets = 0;
    }, 1_000);
  }

  private stopStatsTimer(): void {
    if (this.statsTimer !== null) {
      window.clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private setStatus(status: SignalStatus): void {
    this.status = status;
    this.listeners.onStatus?.(status);
  }
}

/** Turns getUserMedia's DOMException names into something a student can act on. */
function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
      return 'Camera permission was denied. Allow camera access for this app and try again.';
    case 'NotFoundError':
      return 'No camera was found on this computer.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is in use by another app (Zoom, Teams, a browser tab…). Close it and try again.';
    case 'OverconstrainedError':
      return 'The camera does not support the requested video mode.';
    default:
      return error instanceof Error ? error.message : 'Could not open the camera.';
  }
}
