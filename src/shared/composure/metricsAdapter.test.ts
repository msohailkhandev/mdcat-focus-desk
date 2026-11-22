import { describe, expect, it } from 'vitest';

import { toVitalsSample } from './metricsAdapter';

describe('toVitalsSample', () => {
  it('reads the latest entry of each metric array', () => {
    const sample = toVitalsSample(
      {
        cardio: {
          pulseRate: [
            { value: 60, stable: true },
            { value: 72, stable: false },
          ],
        },
        breathing: { rate: [{ value: 14, confidence: 80 }] },
        face: { blinking: [{ detected: false }, { detected: true }] },
      },
      1_000,
      true,
    );

    expect(sample).toEqual({
      tsMs: 1_000,
      valid: true,
      pulseBpm: 72,
      pulseConfidence: 0,
      breathingRpm: 14,
      breathingConfidence: 0.8,
      blinkDetected: true,
    });
  });

  it('leaves fields undefined when the packet carries no sample', () => {
    const sample = toVitalsSample({ cardio: { pulseRate: [] }, breathing: null }, 5, false);
    expect(sample).toEqual({ tsMs: 5, valid: false });
  });

  it('omits confidence when the SDK provides neither stable nor confidence', () => {
    const sample = toVitalsSample({ cardio: { pulseRate: [{ value: 66 }] } }, 0, true);
    expect(sample.pulseBpm).toBe(66);
    expect('pulseConfidence' in sample).toBe(false);
  });
});
