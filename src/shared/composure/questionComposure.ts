import type { QuestionComposure } from '../types';

export interface ComposureScoringOptions {
  /** Pulse delta (bpm) at which the score reaches zero. */
  readonly pulseDeltaForZeroBpm: number;
  /** Breathing delta (rpm) at which the score reaches zero. */
  readonly breathingDeltaForZeroRpm: number;
}

export const DEFAULT_SCORING_OPTIONS: ComposureScoringOptions = {
  pulseDeltaForZeroBpm: 30,
  breathingDeltaForZeroRpm: 10,
};

/**
 * Accumulates the composure signal while a single question is on screen and
 * summarises it when the student moves on.
 */
export class QuestionComposureAccumulator {
  private pulseDeltaSum = 0;
  private pulseCount = 0;
  private breathingDeltaSum = 0;
  private breathingCount = 0;
  private elevatedMs = 0;
  private lastTsMs: number | null = null;

  public constructor(private readonly options: ComposureScoringOptions = DEFAULT_SCORING_OPTIONS) {}

  public record(
    tsMs: number,
    pulseDeltaBpm: number | null,
    breathingDeltaRpm: number | null,
    elevated: boolean,
  ): void {
    if (pulseDeltaBpm !== null) {
      this.pulseDeltaSum += pulseDeltaBpm;
      this.pulseCount += 1;
    }
    if (breathingDeltaRpm !== null) {
      this.breathingDeltaSum += breathingDeltaRpm;
      this.breathingCount += 1;
    }
    if (elevated && this.lastTsMs !== null) {
      this.elevatedMs += Math.max(0, tsMs - this.lastTsMs);
    }
    this.lastTsMs = tsMs;
  }

  public summarise(): QuestionComposure {
    const meanPulseDeltaBpm = this.pulseCount > 0 ? this.pulseDeltaSum / this.pulseCount : null;
    const meanBreathingDeltaRpm =
      this.breathingCount > 0 ? this.breathingDeltaSum / this.breathingCount : null;

    return {
      meanPulseDeltaBpm,
      meanBreathingDeltaRpm,
      elevatedSeconds: this.elevatedMs / 1000,
      sampleCount: Math.max(this.pulseCount, this.breathingCount),
      score: scoreComposure(meanPulseDeltaBpm, meanBreathingDeltaRpm, this.options),
    };
  }
}

/**
 * Maps mean deltas to a 0-100 score. Deltas at or below baseline score 100;
 * the score falls linearly and bottoms out at 0. When both signals are
 * present the lower score wins, because either one being elevated is
 * meaningful. Returns null with no data rather than pretending.
 */
export function scoreComposure(
  meanPulseDeltaBpm: number | null,
  meanBreathingDeltaRpm: number | null,
  options: ComposureScoringOptions = DEFAULT_SCORING_OPTIONS,
): number | null {
  const scores: number[] = [];
  if (meanPulseDeltaBpm !== null) {
    scores.push(linearScore(meanPulseDeltaBpm, options.pulseDeltaForZeroBpm));
  }
  if (meanBreathingDeltaRpm !== null) {
    scores.push(linearScore(meanBreathingDeltaRpm, options.breathingDeltaForZeroRpm));
  }
  if (scores.length === 0) {
    return null;
  }
  return Math.round(Math.min(...scores));
}

function linearScore(delta: number, deltaForZero: number): number {
  if (delta <= 0) {
    return 100;
  }
  return Math.max(0, 100 * (1 - delta / deltaForZero));
}
