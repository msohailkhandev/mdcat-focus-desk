import type { Baseline, VitalsSample } from '../types';

import { isConfident } from './baselineCalibrator';
import { RollingWindow } from './rollingWindow';

export interface ElevationDetectorOptions {
  /** Pulse must exceed baseline by max(relative, absolute) to count as elevated. */
  readonly pulseRelativeRise: number;
  readonly pulseAbsoluteRiseBpm: number;
  readonly breathingRelativeRise: number;
  readonly breathingAbsoluteRiseRpm: number;
  /** Window over which elevation must be sustained. */
  readonly windowMs: number;
  /** Fraction of window samples that must be elevated to trigger. */
  readonly triggerFraction: number;
  /** Minimum samples in the window before a verdict is considered. */
  readonly minWindowSamples: number;
  /** After a nudge, suppress further nudges for this long. */
  readonly cooldownMs: number;
}

export const DEFAULT_ELEVATION_OPTIONS: ElevationDetectorOptions = {
  pulseRelativeRise: 0.15,
  pulseAbsoluteRiseBpm: 12,
  breathingRelativeRise: 0.25,
  breathingAbsoluteRiseRpm: 4,
  windowMs: 20_000,
  triggerFraction: 0.7,
  minWindowSamples: 6,
  cooldownMs: 180_000,
};

export type ElevationState = 'calm' | 'elevated' | 'cooldown';

export interface ElevationVerdict {
  readonly state: ElevationState;
  /** True on the single sample where a nudge should be offered. */
  readonly nudge: boolean;
  /** Latest confident pulse delta vs baseline, if any. */
  readonly pulseDeltaBpm: number | null;
  readonly breathingDeltaRpm: number | null;
}

/**
 * Decides whether the student's pulse/breathing have been *sustainedly*
 * elevated above their own baseline.
 *
 * Design choices, deliberately conservative:
 * - Only confident samples count. Drop-outs (head movement, looking away)
 *   simply don't vote; they never count as "calm" or "elevated".
 * - Elevation must hold for most of a 20-second window, so a single
 *   startled reading never fires a nudge.
 * - A cooldown prevents nudging repeatedly during one stressful stretch.
 *
 * This is a study-companion heuristic, not a clinical measure.
 */
export class ElevationDetector {
  private readonly pulseWindow: RollingWindow;
  private readonly breathingWindow: RollingWindow;
  private cooldownUntilMs = Number.NEGATIVE_INFINITY;

  public constructor(
    private readonly baseline: Baseline,
    private readonly options: ElevationDetectorOptions = DEFAULT_ELEVATION_OPTIONS,
  ) {
    this.pulseWindow = new RollingWindow(options.windowMs);
    this.breathingWindow = new RollingWindow(options.windowMs);
  }

  public push(sample: VitalsSample): ElevationVerdict {
    let pulseDeltaBpm: number | null = null;
    let breathingDeltaRpm: number | null = null;

    if (sample.valid && isConfident(sample.pulseBpm, sample.pulseConfidence)) {
      pulseDeltaBpm = sample.pulseBpm - this.baseline.pulseBpm;
      this.pulseWindow.push(sample.tsMs, pulseDeltaBpm);
    } else {
      this.pulseWindow.advanceTo(sample.tsMs);
    }

    if (sample.valid && isConfident(sample.breathingRpm, sample.breathingConfidence)) {
      breathingDeltaRpm = sample.breathingRpm - this.baseline.breathingRpm;
      this.breathingWindow.push(sample.tsMs, breathingDeltaRpm);
    } else {
      this.breathingWindow.advanceTo(sample.tsMs);
    }

    const elevated = this.isSustainedElevation();
    const inCooldown = sample.tsMs < this.cooldownUntilMs;

    if (elevated && !inCooldown) {
      this.cooldownUntilMs = sample.tsMs + this.options.cooldownMs;
      this.pulseWindow.clear();
      this.breathingWindow.clear();
      return { state: 'elevated', nudge: true, pulseDeltaBpm, breathingDeltaRpm };
    }

    return {
      state: inCooldown ? 'cooldown' : elevated ? 'elevated' : 'calm',
      nudge: false,
      pulseDeltaBpm,
      breathingDeltaRpm,
    };
  }

  private isSustainedElevation(): boolean {
    const pulseThreshold = Math.max(
      this.baseline.pulseBpm * this.options.pulseRelativeRise,
      this.options.pulseAbsoluteRiseBpm,
    );
    const breathingThreshold = Math.max(
      this.baseline.breathingRpm * this.options.breathingRelativeRise,
      this.options.breathingAbsoluteRiseRpm,
    );

    const pulseElevated =
      this.pulseWindow.size >= this.options.minWindowSamples &&
      this.pulseWindow.fraction((d) => d >= pulseThreshold) >= this.options.triggerFraction;

    const breathingElevated =
      this.breathingWindow.size >= this.options.minWindowSamples &&
      this.breathingWindow.fraction((d) => d >= breathingThreshold) >= this.options.triggerFraction;

    // Either signal sustained on its own is enough; requiring both would
    // miss students whose breathing is masked by talking or posture.
    return pulseElevated || breathingElevated;
  }
}
