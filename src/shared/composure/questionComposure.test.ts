import { describe, expect, it } from 'vitest';

import { QuestionComposureAccumulator, scoreComposure } from './questionComposure';

describe('scoreComposure', () => {
  it('returns 100 at or below baseline', () => {
    expect(scoreComposure(0, 0)).toBe(100);
    expect(scoreComposure(-5, -1)).toBe(100);
  });

  it('falls linearly and takes the lower of the two signals', () => {
    expect(scoreComposure(15, 0)).toBe(50);
    expect(scoreComposure(0, 5)).toBe(50);
    expect(scoreComposure(15, 8)).toBe(20);
  });

  it('clamps at zero and returns null with no data', () => {
    expect(scoreComposure(100, null)).toBe(0);
    expect(scoreComposure(null, null)).toBeNull();
  });
});

describe('QuestionComposureAccumulator', () => {
  it('summarises means, elevated time and sample count', () => {
    const acc = new QuestionComposureAccumulator();
    acc.record(0, 10, 2, false);
    acc.record(1_000, 20, null, true);
    acc.record(3_000, null, 4, true);
    acc.record(4_000, 30, 6, false);

    const summary = acc.summarise();
    expect(summary.meanPulseDeltaBpm).toBe(20);
    expect(summary.meanBreathingDeltaRpm).toBe(4);
    expect(summary.elevatedSeconds).toBe(3);
    expect(summary.sampleCount).toBe(3);
    expect(summary.score).toBe(33);
  });

  it('returns null score with no confident samples', () => {
    const acc = new QuestionComposureAccumulator();
    acc.record(0, null, null, false);
    expect(acc.summarise().score).toBeNull();
  });
});
