import { useState, type ReactNode } from 'react';

import { buildSessionReport } from '@shared/report/sessionReport';
import type { SessionRecord } from '@shared/types';

interface HistoryScreenProps {
  readonly sessions: readonly SessionRecord[];
  readonly onOpen: (session: SessionRecord) => void;
  readonly onDeleteAll: () => Promise<void>;
  readonly onHome: () => void;
}

export function HistoryScreen({
  sessions,
  onOpen,
  onDeleteAll,
  onHome,
}: HistoryScreenProps): ReactNode {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const deleteAll = async (): Promise<void> => {
    setBusy(true);
    try {
      await onDeleteAll();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <main className="screen screen--report">
      <header className="report-head">
        <div>
          <p className="eyebrow">Past sessions</p>
          <h2>
            {sessions.length === 0
              ? 'Nothing saved yet'
              : `${sessions.length} saved on this computer`}
          </h2>
        </div>
        <button type="button" className="btn" onClick={onHome}>
          Back to start
        </button>
      </header>

      {sessions.length > 0 && (
        <section className="card">
          <ul className="history">
            {sessions.map((s) => {
              const r = buildSessionReport(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className="history__row"
                    onClick={() => {
                      onOpen(s);
                    }}
                  >
                    <span>{formatRelative(s)}</span>
                    <span>
                      {r.correct}/{r.totalQuestions} correct
                    </span>
                    <span className="muted">
                      {r.overallComposure === null
                        ? 'no composure data'
                        : `composure ${r.overallComposure}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>Your data</h3>
        <p className="muted">
          Sessions are stored in a single local file and never synced anywhere. Deleting removes
          every saved session permanently.
        </p>
        {confirming ? (
          <div className="actions">
            <button
              type="button"
              className="btn btn--danger"
              disabled={busy}
              onClick={() => void deleteAll()}
            >
              Yes, delete everything
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={sessions.length === 0}
            onClick={() => {
              setConfirming(true);
            }}
          >
            Delete all sessions
          </button>
        )}
      </section>
    </main>
  );
}

function formatRelative(session: SessionRecord): string {
  const date = new Date(session.completedAt);
  const when = Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const minutes = Math.round((session.finishedAtMs - session.startedAtMs) / 60_000);
  return `${when} · ${session.answers.length} questions · ${minutes} min`;
}
