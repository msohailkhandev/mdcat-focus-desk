import type { AnswerRecord, SessionRecord, Subject } from '../types';

export interface TopicSummary {
  readonly subject: Subject;
  readonly topic: string;
  readonly questions: number;
  readonly correct: number;
  /** Mean composure score across questions with data; null if none had data. */
  readonly meanComposure: number | null;
  readonly totalElevatedSeconds: number;
}

export interface SessionReport {
  readonly totalQuestions: number;
  readonly answered: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly overallComposure: number | null;
  readonly nudgesOffered: number;
  readonly nudgesAccepted: number;
  readonly durationMinutes: number;
  /** Topics ordered from lowest composure to highest; topics without data last. */
  readonly topics: readonly TopicSummary[];
  /** Up to three topics where composure was clearly lower than the student's overall level. */
  readonly pressurePoints: readonly TopicSummary[];
}

export const PRESSURE_POINT_GAP = 15;

export function buildSessionReport(session: SessionRecord): SessionReport {
  const answers = session.answers;
  const answered = answers.filter((a) => a.selectedIndex !== null).length;
  const correct = answers.filter((a) => a.correct).length;
  const topics = summariseTopics(answers);
  const overallComposure = meanOf(answers.map((a) => a.composure.score));

  const pressurePoints =
    overallComposure === null
      ? []
      : topics
          .filter(
            (t) =>
              t.meanComposure !== null && t.meanComposure <= overallComposure - PRESSURE_POINT_GAP,
          )
          .slice(0, 3);

  return {
    totalQuestions: answers.length,
    answered,
    correct,
    accuracy: answers.length === 0 ? 0 : correct / answers.length,
    overallComposure,
    nudgesOffered: session.nudges.length,
    nudgesAccepted: session.nudges.filter((n) => n.accepted).length,
    durationMinutes: (session.finishedAtMs - session.startedAtMs) / 60_000,
    topics,
    pressurePoints,
  };
}

function summariseTopics(answers: readonly AnswerRecord[]): TopicSummary[] {
  const byKey = new Map<string, AnswerRecord[]>();
  for (const answer of answers) {
    const key = `${answer.subject}::${answer.topic}`;
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.push(answer);
    } else {
      byKey.set(key, [answer]);
    }
  }

  const summaries: TopicSummary[] = [];
  for (const group of byKey.values()) {
    const first = group[0];
    if (first === undefined) {
      continue;
    }
    summaries.push({
      subject: first.subject,
      topic: first.topic,
      questions: group.length,
      correct: group.filter((a) => a.correct).length,
      meanComposure: meanOf(group.map((a) => a.composure.score)),
      totalElevatedSeconds: group.reduce((sum, a) => sum + a.composure.elevatedSeconds, 0),
    });
  }

  return summaries.sort((a, b) => {
    if (a.meanComposure === null && b.meanComposure === null) {
      return a.topic.localeCompare(b.topic);
    }
    if (a.meanComposure === null) {
      return 1;
    }
    if (b.meanComposure === null) {
      return -1;
    }
    return a.meanComposure - b.meanComposure;
  });
}

function meanOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) {
    return null;
  }
  return Math.round(present.reduce((sum, v) => sum + v, 0) / present.length);
}
