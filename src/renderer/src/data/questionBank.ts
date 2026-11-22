import { SUBJECTS, type Question, type Subject } from '@shared/types';

import sampleQuestions from './questions.sample.json';

/**
 * Loads and validates the question bank bundled with the app.
 *
 * The JSON is validated at startup rather than trusted blindly, so a typo in
 * a question file fails loudly instead of rendering a broken test.
 */
export function loadQuestionBank(): Question[] {
  if (!Array.isArray(sampleQuestions)) {
    throw new TypeError('questions.sample.json must be an array');
  }
  const seen = new Set<string>();
  return sampleQuestions.map((raw, i) => {
    const question = parseQuestion(raw, i);
    if (seen.has(question.id)) {
      throw new TypeError(`Duplicate question id "${question.id}"`);
    }
    seen.add(question.id);
    return question;
  });
}

/** Fisher-Yates shuffle; returns a new array, input untouched. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

function parseQuestion(raw: unknown, index: number): Question {
  const where = `question #${index + 1}`;
  if (typeof raw !== 'object' || raw === null) {
    throw new TypeError(`${where}: not an object`);
  }
  const q = raw as Record<string, unknown>;

  const id = requireString(q.id, `${where}.id`);
  const subject = requireSubject(q.subject, `${where}.subject`);
  const topic = requireString(q.topic, `${where}.topic`);
  const stem = requireString(q.stem, `${where}.stem`);

  const options = q.options;
  if (
    !Array.isArray(options) ||
    options.length !== 4 ||
    !options.every((o) => typeof o === 'string')
  ) {
    throw new TypeError(`${where}.options: must be exactly four strings`);
  }
  const [a, b, c, d] = options as [string, string, string, string];

  const answerIndex = q.answerIndex;
  if (answerIndex !== 0 && answerIndex !== 1 && answerIndex !== 2 && answerIndex !== 3) {
    throw new TypeError(`${where}.answerIndex: must be 0, 1, 2 or 3`);
  }

  return { id, subject, topic, stem, options: [a, b, c, d], answerIndex };
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${where}: must be a non-empty string`);
  }
  return value;
}

function requireSubject(value: unknown, where: string): Subject {
  if (typeof value !== 'string' || !(SUBJECTS as readonly string[]).includes(value)) {
    throw new TypeError(`${where}: must be one of ${SUBJECTS.join(', ')}`);
  }
  return value as Subject;
}
