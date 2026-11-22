import type { Baseline, VitalsSample } from '../types';

export interface BaselineCalibratorOptions {
  /** Shortest acceptable collection window, measured from the first valid sample. */
  readonly minDurationMs: number;
  /** Give up after this long without enough confident samples. */
  readonly maxDurationMs: number;
  /** Confident pulse samples required. Pulse locks ~once per second once stable. */
  readonly minPulseSamples: number;
  /** Confident breathing-rate samples required. One arrives per breath cycle (~4 s). */
  readonly minBreathingSamples: number;
}

export const DEFAULT_BASELINE_OPTIONS: BaselineCalibratorOptions = {
  minDurationMs: 12_000,
  maxDurationMs: 75_000,
  minPulseSamples: 5,
  minBreathingSamples: 1,
};

export type CalibrationProgress =
  | {
      readonly state: 'collecting';
      /** 0-1, the larger of time progress and sample progress. */
      readonly fraction: number;
      readonly pulseSamples: number;
      readonly breathingSamples: number;
    }
  | {
      readonly state: 'insufficient';
      readonly pulseSamples: number;
      readonly breathingSamples: number;
    }
  | { readonly state: 'ready'; readonly baseline: Baseline };

/**
 * Collects confident vitals samples and produces the student's resting baseline.
 *
 * Timing rules, chosen from how the SDK actually emits data:
 * - The clock starts at the first *valid* sample (face found, lighting OK),
 *   not at the first packet, so setup time doesn't eat into the window.
 * - Pulse needs ~15-30 s to lock before any sample is `stable`; breathing
 *   rate arrives once per breath. So the window is open-ended: it ends as
 *   soon as both minimums are met (never before `minDurationMs`) and gives
 *   up at `maxDurationMs`.
 * - Only samples the SDK marks valid AND stable contribute. If too few
 *   arrive, the calibrator reports `insufficient` rather than guessing.
 */
export class BaselineCalibrator {
  private startMs: number | null = null;
  private readonly pulse: number[] = [];
  private readonly breathing: number[] = [];

  public constructor(
    private readonly options: BaselineCalibratorOptions = DEFAULT_BASELINE_OPTIONS,
  ) {}

  public reset(): void {
    this.startMs = null;
    this.pulse.length = 0;
    this.breathing.length = 0;
  }

  public push(sample: VitalsSample): CalibrationProgress {
    if (!sample.valid) {
      return this.progress(sample.tsMs);
    }
    this.startMs ??= sample.tsMs;

    if (isConfident(sample.pulseBpm, sample.pulseConfidence)) {
      this.pulse.push(sample.pulseBpm);
    }
    if (isConfident(sample.breathingRpm, sample.breathingConfidence)) {
      this.breathing.push(sample.breathingRpm);
    }

    return this.progress(sample.tsMs);
  }

  public progress(nowMs: number): CalibrationProgress {
    const pulseSamples = this.pulse.length;
    const breathingSamples = this.breathing.length;

    if (this.startMs === null) {
      return { state: 'collecting', fraction: 0, pulseSamples, breathingSamples };
    }

    const elapsed = nowMs - this.startMs;
    const { minDurationMs, maxDurationMs, minPulseSamples, minBreathingSamples } = this.options;
    const enoughSamples =
      pulseSamples >= minPulseSamples && breathingSamples >= minBreathingSamples;

    if (elapsed >= minDurationMs && enoughSamples) {
      return {
        state: 'ready',
        baseline: {
          pulseBpm: median(this.pulse),
          breathingRpm: median(this.breathing),
          sampleCount: Math.min(pulseSamples, breathingSamples),
          capturedAtMs: nowMs,
        },
      };
    }

    if (elapsed >= maxDurationMs) {
      return { state: 'insufficient', pulseSamples, breathingSamples };
    }

    const timeFraction = Math.min(1, elapsed / minDurationMs);
    const sampleFraction = Math.min(
      1,
      Math.min(pulseSamples / minPulseSamples, breathingSamples / minBreathingSamples),
    );
    // Never show 100% until we're actually ready.
    const fraction = Math.min(0.99, Math.max(timeFraction, sampleFraction));

    return { state: 'collecting', fraction, pulseSamples, breathingSamples };
  }
}

/**
 * The SDK's `stable` flag is already a confidence threshold, but we also
 * accept an explicit 0-1 confidence when provided. A reading is confident
 * when it has a value and either no confidence (SDK only gave us `stable`)
 * or a confidence >= 0.4, matching the SDK's own pulse accuracy floor.
 */
export function isConfident(
  value: number | undefined,
  confidence: number | undefined,
): value is number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return false;
  }
  return confidence === undefined || confidence >= 0.4;
}

/** Median is robust to the occasional spike a mean would absorb. */
export function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError('median of empty array');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (upper === undefined) {
    throw new RangeError('unreachable: sorted array has no middle element');
  }
  return sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper;
}
