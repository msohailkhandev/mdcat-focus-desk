import { describe, expect, it } from 'vitest';

import type { Baseline, VitalsSample } from '../types';

import { ElevationDetector, type ElevationDetectorOptions } from './elevationDetector';

const baseline: Baseline = { pulseBpm: 70, breathingRpm: 14, sampleCount: 10, capturedAtMs: 0 };

const options: ElevationDetectorOptions = {
  pulseRelativeRise: 0.15,
  pulseAbsoluteRiseBpm: 12,
  breathingRelativeRise: 0.25,
  breathingAbsoluteRiseRpm: 4,
  windowMs: 10_000,
  triggerFraction: 0.7,
  minWindowSamples: 4,
  cooldownMs: 30_000,
};

function feed(
  detector: ElevationDetector,
  samples: VitalsSample[],
): ReturnType<ElevationDetector['push']>[] {
  return samples.map((s) => detector.push(s));
}

function series(
  startMs: number,
  count: number,
  stepMs: number,
  pulse: number,
  breathing = 14,
  valid = true,
): VitalsSample[] {
  return Array.from({ length: count }, (_, i) => ({
    tsMs: startMs + i * stepMs,
    pulseBpm: pulse,
    pulseConfidence: 1,
    breathingRpm: breathing,
    breathingConfidence: 1,
    valid,
  }));
}

describe('ElevationDetector', () => {
  it('stays calm at baseline', () => {
    const detector = new ElevationDetector(baseline, options);
    const verdicts = feed(detector, series(0, 10, 1_000, 70));
    expect(verdicts.every((v) => v.state === 'calm' && !v.nudge)).toBe(true);
  });

  it('does not nudge on a single spike', () => {
    const detector = new ElevationDetector(baseline, options);
    feed(detector, series(0, 5, 1_000, 70));
    const spike = detector.push({ tsMs: 5_000, pulseBpm: 110, pulseConfidence: 1, valid: true });
    expect(spike.nudge).toBe(false);
    expect(spike.state).toBe('calm');
  });

  it('nudges exactly once when pulse is sustainedly elevated, then enters cooldown', () => {
    const detector = new ElevationDetector(baseline, options);
    const verdicts = feed(detector, series(0, 8, 1_000, 90));
    const nudges = verdicts.filter((v) => v.nudge);
    expect(nudges).toHaveLength(1);

    const after = detector.push({ tsMs: 9_000, pulseBpm: 90, pulseConfidence: 1, valid: true });
    expect(after.state).toBe('cooldown');
    expect(after.nudge).toBe(false);
  });

  it('nudges again after the cooldown expires if still elevated', () => {
    const detector = new ElevationDetector(baseline, options);
    feed(detector, series(0, 8, 1_000, 90));
    const later = feed(detector, series(40_000, 8, 1_000, 90));
    expect(later.filter((v) => v.nudge)).toHaveLength(1);
  });

  it('fires on breathing alone', () => {
    const detector = new ElevationDetector(baseline, options);
    const verdicts = feed(detector, series(0, 8, 1_000, 70, 20));
    expect(verdicts.some((v) => v.nudge)).toBe(true);
  });

  it('ignores invalid samples instead of counting them as calm or elevated', () => {
    const detector = new ElevationDetector(baseline, options);
    const verdicts = feed(detector, series(0, 8, 1_000, 90, 14, false));
    expect(verdicts.every((v) => v.state === 'calm' && v.pulseDeltaBpm === null)).toBe(true);
  });

  it('reports the latest deltas for display', () => {
    const detector = new ElevationDetector(baseline, options);
    const verdict = detector.push({
      tsMs: 0,
      pulseBpm: 75,
      pulseConfidence: 1,
      breathingRpm: 16,
      breathingConfidence: 1,
      valid: true,
    });
    expect(verdict.pulseDeltaBpm).toBe(5);
    expect(verdict.breathingDeltaRpm).toBe(2);
  });
});
