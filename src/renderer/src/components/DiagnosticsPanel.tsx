import { useEffect, useState, type ReactNode } from 'react';

import { useSignal } from '../signal/SignalProvider';

const VALIDATION_NAMES: Record<number, string> = {
  0: 'OK',
  1: 'NoFaceFound',
  2: 'MultipleFacesFound',
  3: 'FaceNotCentered',
  4: 'FaceSizeOutOfRange',
  5: 'TooDark',
  6: 'TooBright',
  7: 'ChestNotVisible',
  10: 'CameraTuning',
  11: 'FrameRateTooLow',
  12: 'ExcessiveMotion',
  13: 'FaceTooClose',
  14: 'FaceTooFar',
  15: 'FaceTooHigh',
  16: 'FaceTooLow',
  17: 'FaceNotForward',
};

/**
 * Developer overlay showing what the SDK is really delivering: frame
 * throughput, validation state and the latest raw readings with confidence.
 * Toggle with Ctrl+D. Never shown to students by default; it exists so
 * thresholds can be tuned against real data instead of guesses.
 */
export function DiagnosticsPanel(): ReactNode {
  const [open, setOpen] = useState(false);
  const signal = useSignal();

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) {
    return null;
  }

  const stats = signal.stats;
  const sample = stats?.lastSample ?? null;
  const code = stats?.validationCode ?? null;
  const fpsClass = stats === null ? '' : stats.fps >= 25 ? 'is-ok' : 'is-bad';

  return (
    <aside className="diag" aria-label="Signal diagnostics">
      <header>
        <strong>Signal diagnostics</strong>
        <span className="muted"> · Ctrl+D to hide</span>
      </header>
      <dl>
        <dt>Status</dt>
        <dd>{signal.status}</dd>
        <dt>Camera</dt>
        <dd>
          {stats?.streamSettings
            ? `${stats.streamSettings.width ?? '?'}×${stats.streamSettings.height ?? '?'} @ ${
                stats.streamSettings.frameRate?.toFixed(0) ?? '?'
              } fps (actual)`
            : ', '}
        </dd>
        <dt>Camera caps</dt>
        <dd>
          {stats?.cameraCapabilities
            ? `${stats.cameraCapabilities.label ?? 'unknown'} · max ${
                stats.cameraCapabilities.maxFrameRate?.toFixed(0) ?? '?'
              } fps · exposure ${stats.cameraCapabilities.exposureModes?.join('/') ?? 'n/a'}`
            : ', '}
        </dd>
        <dt>Exposure</dt>
        <dd>{stats?.exposureLock ?? ', '}</dd>
        <dt>SDK fps</dt>
        <dd className={fpsClass}>
          {stats ? `${stats.fps} accepted · ${stats.droppedFps} dropped` : ', '}
        </dd>
        <dt>Packets/s</dt>
        <dd>{stats ? stats.packetsPerSecond : ', '}</dd>
        <dt>Validation</dt>
        <dd className={code === 0 ? 'is-ok' : 'is-bad'}>
          {code === null ? ', ' : `${code} ${VALIDATION_NAMES[code] ?? ''}`}
          {stats?.validationHint ? `, ${stats.validationHint}` : ''}
        </dd>
        <dt>Pulse</dt>
        <dd>
          {sample?.pulseBpm === undefined
            ? 'no sample'
            : `${sample.pulseBpm.toFixed(1)} bpm · conf ${fmtConf(sample.pulseConfidence)}`}
        </dd>
        <dt>Breathing</dt>
        <dd>
          {sample?.breathingRpm === undefined
            ? 'no sample'
            : `${sample.breathingRpm.toFixed(1)} rpm · conf ${fmtConf(sample.breathingConfidence)}`}
        </dd>
        <dt>Blink</dt>
        <dd>{sample?.blinkDetected === undefined ? 'no sample' : String(sample.blinkDetected)}</dd>
        <dt>Error</dt>
        <dd className={signal.error ? 'is-bad' : ''}>
          {signal.error ? `${signal.error.code}: ${signal.error.message}` : 'none'}
        </dd>
      </dl>
    </aside>
  );
}

function fmtConf(confidence: number | undefined): string {
  if (confidence === undefined) {
    return 'n/a';
  }
  return confidence >= 0.4
    ? `${(confidence * 100).toFixed(0)}% ✓`
    : `${(confidence * 100).toFixed(0)}% ✗`;
}
