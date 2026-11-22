import { useEffect, useState, type ReactNode } from 'react';

import { isConfident } from '@shared/composure/baselineCalibrator';
import type { Baseline, NudgeKind } from '@shared/types';

import { useSignal } from '../signal/SignalProvider';

const PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'] as const;
const PHASE_SECONDS = 4;
const CYCLES = 2;
const TOTAL_SECONDS = PHASES.length * PHASE_SECONDS * CYCLES;

interface BreathingPauseProps {
  readonly kind: NudgeKind;
  readonly baseline: Baseline;
  readonly onDone: () => void;
}

/**
 * A short box-breathing pause (4-4-4-4, two cycles).
 *
 * Unlike a plain timer, this one listens to the live breathing signal: when
 * the measured rate drops below the student's own baseline, the overlay
 * confirms it. If the signal is poor it simply says nothing, it never
 * fabricates reassurance.
 */
export function BreathingPause({ kind, baseline, onDone }: BreathingPauseProps): ReactNode {
  const signal = useSignal();
  const [elapsed, setElapsed] = useState(0);
  const [slowing, setSlowing] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    return signal.subscribe((sample) => {
      if (sample.valid && isConfident(sample.breathingRpm, sample.breathingConfidence)) {
        setSlowing(sample.breathingRpm < baseline.breathingRpm);
      }
    });
  }, [signal.subscribe, baseline.breathingRpm]); // eslint-disable-line react-hooks/exhaustive-deps -- subscribe is stable

  useEffect(() => {
    if (elapsed >= TOTAL_SECONDS) {
      onDone();
    }
  }, [elapsed, onDone]);

  const phaseIndex = Math.floor(elapsed / PHASE_SECONDS) % PHASES.length;
  const phaseSecond = (elapsed % PHASE_SECONDS) + 1;
  const phase = PHASES[phaseIndex] ?? PHASES[0];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Breathing pause">
      <div className="card card--narrow card--center">
        <p className="eyebrow">
          {kind === 'fatigue' ? 'Rest your eyes for a moment' : 'A short reset'}
        </p>
        <div className={`breath breath--${phaseIndex}`}>
          <div className="breath__circle" />
        </div>
        <h2>
          {phase} <span className="muted">· {phaseSecond}</span>
        </h2>
        <p className="muted">{TOTAL_SECONDS - elapsed}s left · the test timer is paused</p>
        <p className={`confirm${slowing ? ' is-on' : ''}`} aria-live="polite">
          {slowing ? '✓ Your breathing has slowed below your resting rate' : ' '}
        </p>
        <button type="button" className="btn btn--ghost" onClick={onDone}>
          Return to the test
        </button>
      </div>
    </div>
  );
}
