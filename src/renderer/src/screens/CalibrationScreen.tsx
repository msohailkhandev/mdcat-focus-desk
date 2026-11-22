import { useEffect, useRef, useState, type ReactNode } from 'react';

import { BaselineCalibrator, type CalibrationProgress } from '@shared/composure/baselineCalibrator';
import type { Baseline } from '@shared/types';

import { CameraPreview } from '../components/CameraPreview';
import { useSignal } from '../signal/SignalProvider';

const INITIAL_PROGRESS: CalibrationProgress = {
  state: 'collecting',
  fraction: 0,
  pulseSamples: 0,
  breathingSamples: 0,
};

interface CalibrationScreenProps {
  readonly onReady: (baseline: Baseline) => void;
  readonly onSkipCamera: () => void;
}

/**
 * Starts the camera and captures a resting baseline.
 *
 * The student sees the live preview, the SDK's positioning hint and a
 * progress ring, but no numbers. Showing a live pulse here would invite
 * people to "perform" for it, which is the opposite of a resting baseline.
 */
export function CalibrationScreen({ onReady, onSkipCamera }: CalibrationScreenProps): ReactNode {
  const signal = useSignal();
  const calibrator = useRef(new BaselineCalibrator());
  const [progress, setProgress] = useState<CalibrationProgress>(INITIAL_PROGRESS);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    signal.start().catch((error: unknown) => {
      setStartError(error instanceof Error ? error.message : String(error));
    });
  }, [signal.start]); // eslint-disable-line react-hooks/exhaustive-deps -- start is stable

  useEffect(() => {
    const current = calibrator.current;
    return signal.subscribe((sample) => {
      const next = current.push(sample);
      setProgress(next);
      if (next.state === 'ready') {
        onReady(next.baseline);
      }
    });
  }, [signal.subscribe, onReady]); // eslint-disable-line react-hooks/exhaustive-deps -- subscribe is stable

  const retry = (): void => {
    calibrator.current.reset();
    setProgress(INITIAL_PROGRESS);
    setStartError(null);
    if (signal.status !== 'running') {
      signal.start().catch((error: unknown) => {
        setStartError(error instanceof Error ? error.message : String(error));
      });
    }
  };

  const fraction = progress.state === 'collecting' ? progress.fraction : 1;
  const errorMessage = startError ?? signal.error?.message ?? null;

  return (
    <main className="screen screen--split">
      <section className="card">
        <p className="eyebrow">Step 1 of 2</p>
        <h2>Finding your resting baseline</h2>
        <p className="lede">
          Sit comfortably, face the camera, and breathe normally. This usually takes 20-40 seconds,
          the pulse signal needs a moment to lock on. Everything later in the test is compared
          against <em>this</em>, not against anyone else.
        </p>

        <div className="ring" style={{ ['--p' as string]: fraction }}>
          <span>{Math.round(fraction * 100)}%</span>
        </div>

        {progress.state === 'collecting' && errorMessage === null && (
          <p className="muted">
            {signal.validationOk
              ? progress.pulseSamples === 0
                ? 'Good signal, locking on to your pulse…'
                : 'Good signal, hold still a little longer.'
              : 'Waiting for a steady signal. Follow the hint on the preview.'}
          </p>
        )}

        {progress.state === 'insufficient' && (
          <div className="notice notice--warn">
            <p>
              Not enough steady readings to set a baseline ({progress.pulseSamples} pulse,{' '}
              {progress.breathingSamples} breathing). Try brighter, even lighting from the front,
              sit about an arm's length away, and keep your face and upper chest still and in frame.
            </p>
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={retry}>
                Try again
              </button>
              <button type="button" className="btn" onClick={onSkipCamera}>
                Continue without camera
              </button>
            </div>
          </div>
        )}

        {errorMessage !== null && (
          <div className="notice notice--error">
            <p>Camera signal could not start: {errorMessage}</p>
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={retry}>
                Try again
              </button>
              <button type="button" className="btn" onClick={onSkipCamera}>
                Continue without camera
              </button>
            </div>
          </div>
        )}
      </section>

      <aside>
        <CameraPreview
          stream={signal.stream}
          validationOk={signal.validationOk}
          hint={signal.validationHint}
        />
      </aside>
    </main>
  );
}
