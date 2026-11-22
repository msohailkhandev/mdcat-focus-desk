import { describe, expect, it } from 'vitest';

import type { VitalsSample } from '../types';

import { BlinkFatigueDetector, type BlinkFatigueOptions } from './blinkFatigueDetector';

const options: BlinkFatigueOptions = {
  windowMs: 60_000,
  lowBlinkRatePerMin: 6,
  warmupMs: 60_000,
  cooldownMs: 120_000,
};

/** One sample per second; blink on every `blinkEvery`-th second (0 = never). */
function run(
  detector: BlinkFatigueDetector,
  fromSec: number,
  toSec: number,
  blinkEvery: number,
): ReturnType<BlinkFatigueDetector['push']>[] {
  const verdicts = [];
  for (let s = fromSec; s < toSec; s += 1) {
    const sample: VitalsSample = {
      tsMs: s * 1_000,
      blinkDetected: blinkEvery > 0 && s % blinkEvery === 0,
      valid: true,
    };
    verdicts.push(detector.push(sample));
  }
  return verdicts;
}

describe('BlinkFatigueDetector', () => {
  it('reports no rate until a full window is covered', () => {
    const detector = new BlinkFatigueDetector(options);
    const verdicts = run(detector, 0, 59, 5);
    expect(verdicts.every((v) => v.blinksPerMinute === null)).toBe(true);
  });

  it('computes blinks per minute on rising edges only', () => {
    const detector = new BlinkFatigueDetector(options);
    // A blink every 4 s => 15/min; held over two consecutive packets must count once.
    for (let s = 0; s <= 60; s += 1) {
      const blinking = s % 4 === 0 || s % 4 === 1;
      detector.push({ tsMs: s * 1_000, blinkDetected: blinking, valid: true });
    }
    const verdict = detector.push({ tsMs: 61_000, blinkDetected: false, valid: true });
    expect(verdict.blinksPerMinute).not.toBeNull();
    expect(verdict.blinksPerMinute).toBeGreaterThan(12);
    expect(verdict.blinksPerMinute).toBeLessThan(18);
  });

  it('nudges once after warmup when the rate is low, then respects cooldown', () => {
    const detector = new BlinkFatigueDetector(options);
    const verdicts = run(detector, 0, 180, 30); // 2 blinks/min
    expect(verdicts.filter((v) => v.nudge)).toHaveLength(1);
  });

  it('does not nudge when blinking normally', () => {
    const detector = new BlinkFatigueDetector(options);
    const verdicts = run(detector, 0, 180, 4); // 15 blinks/min
    expect(verdicts.some((v) => v.nudge)).toBe(false);
  });

  it('does not treat a face drop-out as "no blinks"', () => {
    const detector = new BlinkFatigueDetector(options);
    run(detector, 0, 90, 4);
    for (let s = 90; s < 150; s += 1) {
      const verdict = detector.push({ tsMs: s * 1_000, valid: false });
      expect(verdict).toEqual({ blinksPerMinute: null, nudge: false });
    }
  });
});
