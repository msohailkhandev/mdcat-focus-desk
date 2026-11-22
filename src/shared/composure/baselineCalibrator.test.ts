import { describe, expect, it } from 'vitest';

import type { VitalsSample } from '../types';

import { BaselineCalibrator, median, type BaselineCalibratorOptions } from './baselineCalibrator';

function sample(tsMs: number, pulse: number, breathing: number, valid = true): VitalsSample {
  return {
    tsMs,
    pulseBpm: pulse,
    pulseConfidence: 1,
    breathingRpm: breathing,
    breathingConfidence: 1,
    valid,
  };
}

const options: BaselineCalibratorOptions = {
  minDurationMs: 10_000,
  maxDurationMs: 30_000,
  minPulseSamples: 3,
  minBreathingSamples: 2,
};

describe('BaselineCalibrator', () => {
  it('starts the clock at the first valid sample, not the first packet', () => {
    const calibrator = new BaselineCalibrator(options);
    expect(calibrator.push(sample(0, 70, 14, false))).toEqual({
      state: 'collecting',
      fraction: 0,
      pulseSamples: 0,
      breathingSamples: 0,
    });
    const first = calibrator.push(sample(5_000, 70, 14));
    expect(first.state).toBe('collecting');
    if (first.state === 'collecting') {
      expect(first.fraction).toBeCloseTo(1 / 3); // 1 of 3 pulse samples
    }
  });

  it('is not ready before the minimum duration even with enough samples', () => {
    const calibrator = new BaselineCalibrator(options);
    calibrator.push(sample(0, 70, 14));
    calibrator.push(sample(1_000, 70, 14));
    const progress = calibrator.push(sample(2_000, 70, 14));
    expect(progress.state).toBe('collecting');
    if (progress.state === 'collecting') {
      expect(progress.fraction).toBeLessThan(1);
    }
  });

  it('produces a median-based baseline once duration and sample minimums are met', () => {
    const calibrator = new BaselineCalibrator(options);
    calibrator.push(sample(0, 70, 14));
    calibrator.push(sample(3_000, 95, 15)); // spike that a mean would absorb
    calibrator.push(sample(6_000, 72, 14));
    const progress = calibrator.push(sample(10_000, 71, 16));

    expect(progress.state).toBe('ready');
    if (progress.state === 'ready') {
      expect(progress.baseline.pulseBpm).toBe(71.5);
      expect(progress.baseline.breathingRpm).toBe(14.5);
      expect(progress.baseline.sampleCount).toBe(4);
    }
  });

  it('keeps collecting past the minimum duration until samples arrive', () => {
    const calibrator = new BaselineCalibrator(options);
    calibrator.push(sample(0, 70, 14));
    // Pulse not yet locked for a while: only breathing confident.
    for (let t = 1_000; t <= 15_000; t += 1_000) {
      calibrator.push({ tsMs: t, breathingRpm: 14, breathingConfidence: 1, valid: true });
    }
    expect(calibrator.progress(15_000).state).toBe('collecting');
    calibrator.push(sample(16_000, 70, 14));
    const progress = calibrator.push(sample(17_000, 72, 14));
    expect(progress.state).toBe('ready');
  });

  it('gives up at the maximum duration', () => {
    const calibrator = new BaselineCalibrator(options);
    calibrator.push(sample(0, 70, 14));
    const progress = calibrator.push({ tsMs: 30_000, valid: true });
    expect(progress).toEqual({ state: 'insufficient', pulseSamples: 1, breathingSamples: 1 });
  });

  it('ignores invalid and low-confidence samples', () => {
    const calibrator = new BaselineCalibrator(options);
    calibrator.push(sample(0, 70, 14));
    calibrator.push(sample(1_000, 120, 30, false));
    calibrator.push({ tsMs: 2_000, pulseBpm: 150, pulseConfidence: 0.1, valid: true });
    const progress = calibrator.progress(2_000);
    expect(progress).toMatchObject({ state: 'collecting', pulseSamples: 1, breathingSamples: 1 });
  });

  it('treats a missing confidence as confident (SDK gave stable only)', () => {
    const calibrator = new BaselineCalibrator({ ...options, minDurationMs: 1_000 });
    calibrator.push({ tsMs: 0, pulseBpm: 65, breathingRpm: 12, valid: true });
    calibrator.push({ tsMs: 500, pulseBpm: 65, breathingRpm: 12, valid: true });
    const progress = calibrator.push({ tsMs: 1_000, pulseBpm: 65, breathingRpm: 12, valid: true });
    expect(progress.state).toBe('ready');
  });

  it('reset clears everything', () => {
    const calibrator = new BaselineCalibrator(options);
    calibrator.push(sample(0, 70, 14));
    calibrator.reset();
    expect(calibrator.progress(0)).toEqual({
      state: 'collecting',
      fraction: 0,
      pulseSamples: 0,
      breathingSamples: 0,
    });
  });
});

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('throws on empty input', () => {
    expect(() => median([])).toThrow(RangeError);
  });
});
