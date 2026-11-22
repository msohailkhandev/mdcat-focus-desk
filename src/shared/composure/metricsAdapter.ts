import type { VitalsSample } from '../types';

/**
 * The subset of the SmartSpectra `Metrics` protobuf this app reads.
 *
 * Declared structurally (rather than importing the SDK's generated types) so
 * the pure domain layer stays free of the native SDK dependency and remains
 * unit-testable with plain objects.
 */
export interface MetricsLike {
  readonly cardio?: {
    readonly pulseRate?: readonly MeasurementLike[] | null;
  } | null;
  readonly breathing?: {
    readonly rate?: readonly MeasurementLike[] | null;
  } | null;
  readonly face?: {
    readonly blinking?: readonly DetectionLike[] | null;
  } | null;
}

export interface MeasurementLike {
  readonly value?: number | null;
  readonly stable?: boolean | null;
  /** SDK reports confidence as a percentage, 0-100. */
  readonly confidence?: number | null;
}

export interface DetectionLike {
  readonly detected?: boolean | null;
  readonly stable?: boolean | null;
}

/**
 * Converts one decoded metrics packet into a {@link VitalsSample}.
 *
 * Only the *latest* entry of each array is used; the SDK batches several
 * samples per packet and the newest is what matters for a live signal.
 * Fields with no new sample are left undefined so downstream logic never
 * mistakes "no data" for a reading.
 */
export function toVitalsSample(
  metrics: MetricsLike,
  tsMs: number,
  validationOk: boolean,
): VitalsSample {
  const pulse = last(metrics.cardio?.pulseRate);
  const breathing = last(metrics.breathing?.rate);
  const blink = last(metrics.face?.blinking);

  const sample: {
    -readonly [K in keyof VitalsSample]: VitalsSample[K];
  } = { tsMs, valid: validationOk };

  if (pulse && isNumber(pulse.value)) {
    sample.pulseBpm = pulse.value;
    const confidence = toUnitConfidence(pulse);
    if (confidence !== undefined) {
      sample.pulseConfidence = confidence;
    }
  }
  if (breathing && isNumber(breathing.value)) {
    sample.breathingRpm = breathing.value;
    const confidence = toUnitConfidence(breathing);
    if (confidence !== undefined) {
      sample.breathingConfidence = confidence;
    }
  }
  if (blink && typeof blink.detected === 'boolean') {
    sample.blinkDetected = blink.detected;
  }

  return sample;
}

/**
 * Prefer the SDK's own `stable` verdict (its accuracy floor), expressed as a
 * 0/1 confidence; fall back to the raw percentage when `stable` is absent.
 */
function toUnitConfidence(measurement: MeasurementLike): number | undefined {
  if (typeof measurement.stable === 'boolean') {
    return measurement.stable ? 1 : 0;
  }
  if (isNumber(measurement.confidence)) {
    return Math.min(1, Math.max(0, measurement.confidence / 100));
  }
  return undefined;
}

function last<T>(items: readonly T[] | null | undefined): T | undefined {
  if (!items || items.length === 0) {
    return undefined;
  }
  return items[items.length - 1];
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
