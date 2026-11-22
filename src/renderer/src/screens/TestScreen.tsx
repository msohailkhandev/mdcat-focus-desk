import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { TestSession } from '@shared/session/testSession';
import type { Baseline, NudgeKind, Question, SessionRecord } from '@shared/types';

import { BreathingPause } from '../components/BreathingPause';
import { CameraPreview } from '../components/CameraPreview';
import { NudgePrompt } from '../components/NudgePrompt';
import { useSignal } from '../signal/SignalProvider';

/** MDCAT allows ~63 s per question (200 questions in 210 minutes). */
const SECONDS_PER_QUESTION = 65;

interface TestScreenProps {
  readonly questions: readonly Question[];
  readonly baseline: Baseline | null;
  readonly onFinish: (record: SessionRecord) => void;
}

type Pause = { readonly kind: NudgeKind } | null;

export function TestScreen({ questions, baseline, onFinish }: TestScreenProps): ReactNode {
  const signal = useSignal();
  // Lazily constructed once; the engine instance is stable for the screen's lifetime.
  const [current] = useState(
    () =>
      new TestSession({
        id: crypto.randomUUID(),
        questions,
        baseline,
        startedAtMs: performance.now(),
      }),
  );

  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [offeredNudge, setOfferedNudge] = useState<NudgeKind | null>(null);
  const [pause, setPause] = useState<Pause>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(questions.length * SECONDS_PER_QUESTION);
  const finishedRef = useRef(false);

  const question = useMemo(() => questions[questionIndex], [questions, questionIndex]);

  const finish = useCallback(() => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    const record = current.finish(performance.now(), new Date().toISOString());
    void signal.stop();
    onFinish(record);
  }, [current, onFinish, signal]);

  // Countdown; paused while a breathing pause overlay is open.
  useEffect(() => {
    if (pause) {
      return;
    }
    const id = window.setInterval(() => {
      setRemainingSeconds((s) => Math.max(0, s - 1));
    }, 1_000);
    return () => {
      window.clearInterval(id);
    };
  }, [pause]);

  useEffect(() => {
    if (remainingSeconds === 0) {
      finish();
    }
  }, [remainingSeconds, finish]);

  // Feed live samples into the session; surface a nudge when the engine says so.
  useEffect(() => {
    if (!baseline) {
      return;
    }
    return signal.subscribe((sample) => {
      if (pause) {
        return; // Readings during the pause belong to the pause, not the question.
      }
      const outcome = current.pushSample(sample);
      if (outcome.nudge) {
        setOfferedNudge(outcome.nudge);
      }
    });
  }, [signal.subscribe, current, baseline, pause]); // eslint-disable-line react-hooks/exhaustive-deps -- subscribe is stable

  const next = (): void => {
    current.answer(selected, performance.now());
    setSelected(null);
    setOfferedNudge(null);
    if (current.isFinished) {
      finish();
    } else {
      setQuestionIndex(current.currentIndex);
    }
  };

  const acceptNudge = (): void => {
    if (!offeredNudge) {
      return;
    }
    current.resolveNudge(true);
    setPause({ kind: offeredNudge });
    setOfferedNudge(null);
  };

  const dismissNudge = (): void => {
    current.resolveNudge(false);
    setOfferedNudge(null);
  };

  if (!question) {
    return null;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <main className={`screen screen--test${baseline ? '' : ' screen--test-solo'}`}>
      <header className="testbar">
        <span className="testbar__progress">
          Question {questionIndex + 1} / {questions.length}
        </span>
        <span className="testbar__subject">
          {question.subject} · {question.topic}
        </span>
        <span className={`testbar__timer${remainingSeconds < 60 ? ' is-low' : ''}`}>
          {minutes}:{seconds}
        </span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={finish}>
          End test
        </button>
      </header>

      <section className="card card--question">
        <p className="stem">{question.stem}</p>
        <ol className="options">
          {question.options.map((option, i) => (
            <li key={option}>
              <button
                type="button"
                className={`option${selected === i ? ' is-selected' : ''}`}
                onClick={() => {
                  setSelected(i);
                }}
              >
                <span className="option__letter">{String.fromCharCode(65 + i)}</span>
                {option}
              </button>
            </li>
          ))}
        </ol>
        <div className="actions">
          <button type="button" className="btn btn--primary" onClick={next}>
            {questionIndex + 1 === questions.length ? 'Finish' : 'Next'}
          </button>
          {selected === null && (
            <span className="muted small">You can skip without answering.</span>
          )}
        </div>
      </section>

      {baseline && (
        <aside className="test-side">
          <CameraPreview
            compact
            stream={signal.stream}
            validationOk={signal.validationOk}
            hint={signal.validationHint}
          />
          <p className="muted small">
            Live numbers are hidden on purpose, you’ll see the full picture at the end.
          </p>
        </aside>
      )}

      {offeredNudge && (
        <NudgePrompt kind={offeredNudge} onAccept={acceptNudge} onDismiss={dismissNudge} />
      )}

      {pause && baseline && (
        <BreathingPause
          kind={pause.kind}
          baseline={baseline}
          onDone={() => {
            setPause(null);
          }}
        />
      )}
    </main>
  );
}
