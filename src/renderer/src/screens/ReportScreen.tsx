import { useMemo, type ReactNode } from 'react';

import { buildSessionReport, type TopicSummary } from '@shared/report/sessionReport';
import type { SessionRecord } from '@shared/types';

interface ReportScreenProps {
  readonly session: SessionRecord;
  readonly onHome: () => void;
}

export function ReportScreen({ session, onHome }: ReportScreenProps): ReactNode {
  const report = useMemo(() => buildSessionReport(session), [session]);
  const noSignal = !session.cameraEnabled || report.overallComposure === null;

  return (
    <main className="screen screen--report">
      <header className="report-head">
        <div>
          <p className="eyebrow">Session report</p>
          <h2>
            {report.correct} / {report.totalQuestions} correct
            <span className="muted"> · {Math.round(report.accuracy * 100)}%</span>
          </h2>
        </div>
        <button type="button" className="btn" onClick={onHome}>
          Back to start
        </button>
      </header>

      <section className="stats">
        <Stat
          label="Composure"
          value={noSignal ? ', ' : `${report.overallComposure}`}
          hint="100 = at your resting baseline"
        />
        <Stat label="Duration" value={`${Math.round(report.durationMinutes)} min`} />
        <Stat
          label="Pauses offered"
          value={`${report.nudgesOffered}`}
          hint={`${report.nudgesAccepted} taken`}
        />
        <Stat
          label="Resting pulse"
          value={session.cameraEnabled ? `${Math.round(session.baseline.pulseBpm)} bpm` : ', '}
          hint="your baseline this session"
        />
      </section>

      {noSignal && (
        <section className="card">
          <h3>No composure data for this session</h3>
          <p className="muted">
            {session.cameraEnabled
              ? 'The camera signal was too unsteady to score composure. Better lighting and keeping your face and upper chest in frame usually fixes this.'
              : 'You practised without the camera. Start a session with the camera to see which topics raise your pulse.'}
          </p>
        </section>
      )}

      {!noSignal && report.pressurePoints.length > 0 && (
        <section className="card card--accent">
          <h3>Pressure points</h3>
          <p className="muted">
            Topics where you were noticeably less composed than your session average. Worth a calm
            revision session, and a note that accuracy and composure don’t always match.
          </p>
          <ul className="pressure">
            {report.pressurePoints.map((t) => (
              <li key={`${t.subject}-${t.topic}`}>
                <strong>{t.topic}</strong>
                <span className="muted"> · {t.subject}</span>
                <span className="pressure__score">{t.meanComposure}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>By topic</h3>
        <table className="topics">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Subject</th>
              <th>Correct</th>
              <th>Composure</th>
              <th>Elevated</th>
            </tr>
          </thead>
          <tbody>
            {report.topics.map((t) => (
              <TopicRow key={`${t.subject}-${t.topic}`} topic={t} />
            ))}
          </tbody>
        </table>
      </section>

      <p className="muted small">
        Composure is a comparison against your own resting baseline from the start of this session.
        It is not a health measurement.
      </p>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }): ReactNode {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint !== undefined && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

function TopicRow({ topic }: { topic: TopicSummary }): ReactNode {
  const composure = topic.meanComposure;
  return (
    <tr>
      <td>{topic.topic}</td>
      <td className="muted">{topic.subject}</td>
      <td>
        {topic.correct} / {topic.questions}
      </td>
      <td>
        {composure === null ? (
          <span className="muted">no data</span>
        ) : (
          <span className="bar" style={{ ['--v' as string]: composure / 100 }}>
            <span className="bar__fill" />
            <span className="bar__label">{composure}</span>
          </span>
        )}
      </td>
      <td className="muted">{Math.round(topic.totalElevatedSeconds)} s</td>
    </tr>
  );
}
