/**
 * Domain types shared by the main process, preload bridge and renderer.
 *
 * Everything here is plain data (JSON-serialisable) so it can cross the
 * Electron IPC boundary without transformation.
 */

export const SUBJECTS = [
  'Biology',
  'Chemistry',
  'Physics',
  'English',
  'Logical Reasoning',
] as const;
export type Subject = (typeof SUBJECTS)[number];

export interface Question {
  readonly id: string;
  readonly subject: Subject;
  /** Fine-grained topic used for the per-topic composure report, e.g. "Kinematics". */
  readonly topic: string;
  readonly stem: string;
  readonly options: readonly [string, string, string, string];
  /** Index into `options` (0-3). */
  readonly answerIndex: 0 | 1 | 2 | 3;
}

/**
 * One normalised reading derived from a SmartSpectra metrics packet.
 *
 * Any field may be absent when the SDK produced no new sample for it in that
 * packet. Consumers must never treat an absent field as "zero", see
 * {@link VitalsSample.valid} and the composure engine's confidence gating.
 */
export interface VitalsSample {
  /** Monotonic timestamp in milliseconds (renderer clock). */
  readonly tsMs: number;
  readonly pulseBpm?: number;
  /** 0-1 confidence reported by the SDK for the pulse value. */
  readonly pulseConfidence?: number;
  readonly breathingRpm?: number;
  readonly breathingConfidence?: number;
  /** True when the SDK reported a blink in this packet. */
  readonly blinkDetected?: boolean;
  /** False while the SDK's validation status is anything other than OK. */
  readonly valid: boolean;
}

export interface Baseline {
  readonly pulseBpm: number;
  readonly breathingRpm: number;
  /** Number of confident samples that contributed. */
  readonly sampleCount: number;
  readonly capturedAtMs: number;
}

export type NudgeKind = 'elevated' | 'fatigue';

export interface NudgeEvent {
  readonly atMs: number;
  readonly questionId: string;
  readonly kind: NudgeKind;
  /** Whether the student accepted the offered pause. */
  readonly accepted: boolean;
}

export interface AnswerRecord {
  readonly questionId: string;
  readonly subject: Subject;
  readonly topic: string;
  /** `null` when the question was skipped or the test ended first. */
  readonly selectedIndex: number | null;
  readonly correct: boolean;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  /** Composure summary for the time spent on this question. */
  readonly composure: QuestionComposure;
}

export interface QuestionComposure {
  /** Mean pulse delta vs baseline (bpm) over confident samples; null if none. */
  readonly meanPulseDeltaBpm: number | null;
  /** Mean breathing delta vs baseline (rpm) over confident samples; null if none. */
  readonly meanBreathingDeltaRpm: number | null;
  /** Seconds during which the elevation detector considered the student elevated. */
  readonly elevatedSeconds: number;
  /** Count of confident samples that contributed. */
  readonly sampleCount: number;
  /** 0-100 where 100 = fully at baseline. null when there is no usable data. */
  readonly score: number | null;
}

export interface SessionRecord {
  readonly id: string;
  /** Monotonic clock (ms), used for durations, not dates. */
  readonly startedAtMs: number;
  readonly finishedAtMs: number;
  /** Wall-clock completion time, ISO 8601, for display in history. */
  readonly completedAt: string;
  readonly baseline: Baseline;
  readonly answers: readonly AnswerRecord[];
  readonly nudges: readonly NudgeEvent[];
  /** Whether the camera signal was enabled for this session (student may opt out). */
  readonly cameraEnabled: boolean;
}

export interface AppConfig {
  /** Present only when the key is configured; the renderer never persists it. */
  readonly smartSpectraApiKey: string | null;
  readonly appVersion: string;
}
