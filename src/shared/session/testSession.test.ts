import { describe, expect, it } from 'vitest';

import type { Baseline, Question, VitalsSample } from '../types';

import { TestSession } from './testSession';

const questions: Question[] = [
  {
    id: 'q1',
    subject: 'Physics',
    topic: 'Kinematics',
    stem: 'A',
    options: ['a', 'b', 'c', 'd'],
    answerIndex: 1,
  },
  {
    id: 'q2',
    subject: 'Biology',
    topic: 'Cell',
    stem: 'B',
    options: ['a', 'b', 'c', 'd'],
    answerIndex: 0,
  },
];

const ISO = '2026-11-11T12:00:00.000Z';

const baseline: Baseline = { pulseBpm: 70, breathingRpm: 14, sampleCount: 10, capturedAtMs: 0 };

function elevated(tsMs: number): VitalsSample {
  return {
    tsMs,
    pulseBpm: 95,
    pulseConfidence: 1,
    breathingRpm: 14,
    breathingConfidence: 1,
    valid: true,
  };
}

describe('TestSession', () => {
  it('walks through questions and records answers with composure', () => {
    const session = new TestSession({ id: 's', questions, baseline, startedAtMs: 0 });
    expect(session.currentQuestion.id).toBe('q1');

    session.pushSample({ tsMs: 1_000, pulseBpm: 80, pulseConfidence: 1, valid: true });
    session.answer(1, 10_000);
    expect(session.currentQuestion.id).toBe('q2');

    session.answer(3, 20_000);
    expect(session.isFinished).toBe(true);

    const record = session.finish(20_000, ISO);
    expect(record.answers).toHaveLength(2);
    expect(record.answers[0]?.correct).toBe(true);
    expect(record.answers[0]?.composure.meanPulseDeltaBpm).toBe(10);
    expect(record.answers[1]?.correct).toBe(false);
    expect(record.answers[1]?.composure.score).toBeNull();
    expect(record.cameraEnabled).toBe(true);
  });

  it('surfaces a nudge once and records the student response', () => {
    const session = new TestSession({ id: 's', questions, baseline, startedAtMs: 0 });
    const nudges = [];
    for (let s = 0; s < 40; s += 1) {
      const outcome = session.pushSample(elevated(s * 1_000));
      if (outcome.nudge) {
        nudges.push(outcome.nudge);
      }
    }
    expect(nudges).toEqual(['elevated']);

    // Further samples never re-nudge while one is pending.
    expect(session.pushSample(elevated(41_000)).nudge).toBeNull();

    session.resolveNudge(true);
    const record = session.finish(60_000, ISO);
    expect(record.nudges).toEqual([
      { atMs: expect.any(Number) as number, questionId: 'q1', kind: 'elevated', accepted: true },
    ]);
  });

  it('tracks nothing when the camera is disabled', () => {
    const session = new TestSession({ id: 's', questions, baseline: null, startedAtMs: 0 });
    const outcome = session.pushSample(elevated(0));
    expect(outcome).toEqual({ nudge: null, verdict: null, blinksPerMinute: null });
    const record = session.finish(5_000, ISO);
    expect(record.cameraEnabled).toBe(false);
    expect(record.answers[0]?.composure.score).toBeNull();
  });

  it('records the current question as unanswered when finished early', () => {
    const session = new TestSession({ id: 's', questions, baseline, startedAtMs: 0 });
    const record = session.finish(5_000, ISO);
    expect(record.answers).toHaveLength(1);
    expect(record.answers[0]?.selectedIndex).toBeNull();
    expect(record.answers[0]?.correct).toBe(false);
  });

  it('rejects an empty question list', () => {
    expect(() => new TestSession({ id: 's', questions: [], baseline, startedAtMs: 0 })).toThrow(
      RangeError,
    );
  });
});
