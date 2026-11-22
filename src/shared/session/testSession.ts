import { BlinkFatigueDetector } from '../composure/blinkFatigueDetector';
import { ElevationDetector, type ElevationVerdict } from '../composure/elevationDetector';
import { QuestionComposureAccumulator } from '../composure/questionComposure';
import type {
  AnswerRecord,
  Baseline,
  NudgeEvent,
  NudgeKind,
  Question,
  SessionRecord,
  VitalsSample,
} from '../types';

export interface TestSessionOptions {
  readonly id: string;
  readonly questions: readonly Question[];
  /** `null` when the student declined the camera; composure is then not tracked. */
  readonly baseline: Baseline | null;
  readonly startedAtMs: number;
}

export interface SampleOutcome {
  /** A nudge to offer the student, or null. At most one nudge per sample. */
  readonly nudge: NudgeKind | null;
  readonly verdict: ElevationVerdict | null;
  readonly blinksPerMinute: number | null;
}

/**
 * Orchestrates one practice test: question flow, per-question composure
 * accumulation, and nudge bookkeeping.
 *
 * Pure and clock-agnostic, every method takes the current time explicitly,
 * so the whole flow is unit-testable without React or the SDK.
 */
export class TestSession {
  private readonly answers: AnswerRecord[] = [];
  private readonly nudges: NudgeEvent[] = [];
  private readonly elevation: ElevationDetector | null;
  private readonly fatigue: BlinkFatigueDetector | null;
  private accumulator = new QuestionComposureAccumulator();
  private index = 0;
  private questionStartedAtMs: number;
  private pendingNudge: NudgeEvent | null = null;
  private lastElevated = false;
  private finished = false;

  public constructor(private readonly options: TestSessionOptions) {
    if (options.questions.length === 0) {
      throw new RangeError('A test session needs at least one question');
    }
    this.questionStartedAtMs = options.startedAtMs;
    this.elevation = options.baseline ? new ElevationDetector(options.baseline) : null;
    this.fatigue = options.baseline ? new BlinkFatigueDetector() : null;
  }

  public get currentIndex(): number {
    return this.index;
  }

  public get totalQuestions(): number {
    return this.options.questions.length;
  }

  public get currentQuestion(): Question {
    const question = this.options.questions[this.index];
    if (question === undefined) {
      throw new RangeError('No current question: session is finished');
    }
    return question;
  }

  public get isFinished(): boolean {
    return this.finished;
  }

  public get cameraEnabled(): boolean {
    return this.options.baseline !== null;
  }

  /** Feed one vitals reading. Returns at most one nudge to surface. */
  public pushSample(sample: VitalsSample): SampleOutcome {
    if (this.finished || !this.elevation || !this.fatigue) {
      return { nudge: null, verdict: null, blinksPerMinute: null };
    }

    const verdict = this.elevation.push(sample);
    this.lastElevated = verdict.state === 'elevated';
    this.accumulator.record(
      sample.tsMs,
      verdict.pulseDeltaBpm,
      verdict.breathingDeltaRpm,
      this.lastElevated,
    );

    const blink = this.fatigue.push(sample);

    let nudge: NudgeKind | null = null;
    if (this.pendingNudge === null) {
      if (verdict.nudge) {
        nudge = 'elevated';
      } else if (blink.nudge) {
        nudge = 'fatigue';
      }
    }
    if (nudge) {
      this.pendingNudge = {
        atMs: sample.tsMs,
        questionId: this.currentQuestion.id,
        kind: nudge,
        accepted: false,
      };
    }

    return { nudge, verdict, blinksPerMinute: blink.blinksPerMinute };
  }

  /** Record whether the student accepted the most recent nudge. */
  public resolveNudge(accepted: boolean): void {
    if (!this.pendingNudge) {
      return;
    }
    this.nudges.push({ ...this.pendingNudge, accepted });
    this.pendingNudge = null;
  }

  public answer(selectedIndex: number | null, nowMs: number): void {
    if (this.finished) {
      return;
    }
    const question = this.currentQuestion;
    this.answers.push({
      questionId: question.id,
      subject: question.subject,
      topic: question.topic,
      selectedIndex,
      correct: selectedIndex === question.answerIndex,
      startedAtMs: this.questionStartedAtMs,
      endedAtMs: nowMs,
      composure: this.accumulator.summarise(),
    });

    this.index += 1;
    this.questionStartedAtMs = nowMs;
    this.accumulator = new QuestionComposureAccumulator();

    if (this.index >= this.options.questions.length) {
      this.finished = true;
    }
  }

  /** Ends the session early; the current question is recorded as unanswered. */
  public finish(nowMs: number, completedAt: string): SessionRecord {
    if (!this.finished) {
      this.answer(null, nowMs);
      this.finished = true;
    }
    if (this.pendingNudge) {
      this.resolveNudge(false);
    }
    return {
      id: this.options.id,
      startedAtMs: this.options.startedAtMs,
      finishedAtMs: nowMs,
      completedAt,
      baseline: this.options.baseline ?? {
        pulseBpm: 0,
        breathingRpm: 0,
        sampleCount: 0,
        capturedAtMs: 0,
      },
      answers: [...this.answers],
      nudges: [...this.nudges],
      cameraEnabled: this.cameraEnabled,
    };
  }
}
