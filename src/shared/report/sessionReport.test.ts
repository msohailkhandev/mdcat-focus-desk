import { describe, expect, it } from 'vitest';

import type { AnswerRecord, SessionRecord } from '../types';

import { buildSessionReport } from './sessionReport';

function answer(
  id: string,
  subject: AnswerRecord['subject'],
  topic: string,
  correct: boolean,
  score: number | null,
  elevatedSeconds = 0,
): AnswerRecord {
  return {
    questionId: id,
    subject,
    topic,
    selectedIndex: 0,
    correct,
    startedAtMs: 0,
    endedAtMs: 30_000,
    composure: {
      meanPulseDeltaBpm: null,
      meanBreathingDeltaRpm: null,
      elevatedSeconds,
      sampleCount: score === null ? 0 : 5,
      score,
    },
  };
}

const session: SessionRecord = {
  id: 's1',
  startedAtMs: 0,
  finishedAtMs: 12 * 60_000,
  completedAt: '2026-11-11T12:00:00.000Z',
  baseline: { pulseBpm: 70, breathingRpm: 14, sampleCount: 10, capturedAtMs: 0 },
  cameraEnabled: true,
  nudges: [
    { atMs: 1, questionId: 'q1', kind: 'elevated', accepted: true },
    { atMs: 2, questionId: 'q3', kind: 'fatigue', accepted: false },
  ],
  answers: [
    answer('q1', 'Physics', 'Kinematics', false, 40, 20),
    answer('q2', 'Physics', 'Kinematics', true, 50, 5),
    answer('q3', 'Biology', 'Cell Biology', true, 95),
    answer('q4', 'Chemistry', 'Stoichiometry', true, 90),
    answer('q5', 'English', 'Grammar', true, null),
  ],
};

describe('buildSessionReport', () => {
  it('aggregates totals and composure', () => {
    const report = buildSessionReport(session);
    expect(report.totalQuestions).toBe(5);
    expect(report.correct).toBe(4);
    expect(report.accuracy).toBeCloseTo(0.8);
    expect(report.overallComposure).toBe(69);
    expect(report.nudgesOffered).toBe(2);
    expect(report.nudgesAccepted).toBe(1);
    expect(report.durationMinutes).toBe(12);
  });

  it('orders topics by composure, lowest first, with no-data topics last', () => {
    const report = buildSessionReport(session);
    expect(report.topics.map((t) => t.topic)).toEqual([
      'Kinematics',
      'Stoichiometry',
      'Cell Biology',
      'Grammar',
    ]);
    const kinematics = report.topics[0];
    expect(kinematics?.meanComposure).toBe(45);
    expect(kinematics?.totalElevatedSeconds).toBe(25);
    expect(kinematics?.correct).toBe(1);
  });

  it('flags pressure points as topics well below the overall composure', () => {
    const report = buildSessionReport(session);
    expect(report.pressurePoints.map((t) => t.topic)).toEqual(['Kinematics']);
  });

  it('handles an empty session', () => {
    const report = buildSessionReport({ ...session, answers: [], nudges: [] });
    expect(report.accuracy).toBe(0);
    expect(report.overallComposure).toBeNull();
    expect(report.pressurePoints).toEqual([]);
  });
});
