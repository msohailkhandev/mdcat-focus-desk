import type { VitalsSample } from '../types';

export interface BlinkFatigueOptions {
  /** Window over which blink rate is measured. */
  readonly windowMs: number;
  /** Blinks per minute at or below which the student is considered strained. */
  readonly lowBlinkRatePerMin: number;
  /** Don't judge before this much session time has elapsed. */
  readonly warmupMs: number;
  /** Minimum gap between fatigue nudges. */
  readonly cooldownMs: number;
}

export const DEFAULT_BLINK_FATIGUE_OPTIONS: BlinkFatigueOptions = {
  windowMs: 5 * 60_000,
  lowBlinkRatePerMin: 6,
  warmupMs: 10 * 60_000,
  cooldownMs: 15 * 60_000,
};

export interface BlinkFatigueVerdict {
  readonly blinksPerMinute: number | null;
  readonly nudge: boolean;
}

/**
 * Tracks blink rate from the SDK's per-packet blink detection flag.
 *
 * Sustained screen focus tends to suppress blinking; a low blink rate over
 * several minutes is a gentle cue to rest the eyes. Blinks are counted on the
 * rising edge of `blinkDetected` so a blink spanning several packets counts
 * once.
 */
export class BlinkFatigueDetector {
  private readonly blinkTimestamps: number[] = [];
  private previousDetected = false;
  private firstSampleMs: number | null = null;
  private coveredFromMs: number | null = null;
  private cooldownUntilMs = Number.NEGATIVE_INFINITY;

  public constructor(
    private readonly options: BlinkFatigueOptions = DEFAULT_BLINK_FATIGUE_OPTIONS,
  ) {}

  public push(sample: VitalsSample): BlinkFatigueVerdict {
    this.firstSampleMs ??= sample.tsMs;

    if (!sample.valid || sample.blinkDetected === undefined) {
      // No face data: we cannot judge, and we must not accumulate "no blinks".
      this.previousDetected = false;
      this.coveredFromMs = null;
      return { blinksPerMinute: null, nudge: false };
    }

    this.coveredFromMs ??= sample.tsMs;

    if (sample.blinkDetected && !this.previousDetected) {
      this.blinkTimestamps.push(sample.tsMs);
    }
    this.previousDetected = sample.blinkDetected;

    const windowStart = sample.tsMs - this.options.windowMs;
    while (this.blinkTimestamps.length > 0) {
      const oldest = this.blinkTimestamps[0];
      if (oldest === undefined || oldest >= windowStart) {
        break;
      }
      this.blinkTimestamps.shift();
    }

    const coveredMs = sample.tsMs - Math.max(this.coveredFromMs, windowStart);
    if (coveredMs < this.options.windowMs) {
      return { blinksPerMinute: null, nudge: false };
    }

    const blinksPerMinute = (this.blinkTimestamps.length / this.options.windowMs) * 60_000;
    const warmedUp = sample.tsMs - this.firstSampleMs >= this.options.warmupMs;
    const inCooldown = sample.tsMs < this.cooldownUntilMs;

    if (warmedUp && !inCooldown && blinksPerMinute <= this.options.lowBlinkRatePerMin) {
      this.cooldownUntilMs = sample.tsMs + this.options.cooldownMs;
      return { blinksPerMinute, nudge: true };
    }

    return { blinksPerMinute, nudge: false };
  }
}
