import type { ReactNode } from 'react';

interface WelcomeScreenProps {
  readonly apiKeyConfigured: boolean;
  readonly questionCount: number;
  readonly historyCount: number;
  readonly onStartWithCamera: () => void;
  readonly onStartWithoutCamera: () => void;
  readonly onViewHistory: () => void;
}

export function WelcomeScreen({
  apiKeyConfigured,
  questionCount,
  historyCount,
  onStartWithCamera,
  onStartWithoutCamera,
  onViewHistory,
}: WelcomeScreenProps): ReactNode {
  return (
    <main className="screen screen--center">
      <section className="card card--hero">
        <p className="eyebrow">MDCAT Focus Desk</p>
        <h1>Practice under pressure. See where it bites.</h1>
        <p className="lede">
          Take a timed practice test. With your permission, your webcam tracks how composed you stay
          , and afterwards you see which <em>topics</em> push your pulse up, not just which ones you
          got wrong.
        </p>

        <ul className="pillars">
          <li>
            <strong>Nothing leaves this computer.</strong> Frames are processed locally; no video is
            recorded or uploaded.
          </li>
          <li>
            <strong>You stay in control.</strong> The camera only runs after you say yes, and a live
            preview is always visible while it does.
          </li>
          <li>
            <strong>Not a medical tool.</strong> This is a study companion. It makes no diagnosis
            and gives no health advice.
          </li>
        </ul>

        <div className="actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onStartWithCamera}
            disabled={!apiKeyConfigured}
          >
            Start with camera
          </button>
          <button type="button" className="btn" onClick={onStartWithoutCamera}>
            Start without camera
          </button>
          <button type="button" className="btn btn--ghost" onClick={onViewHistory}>
            Past sessions{historyCount > 0 ? ` (${historyCount})` : ''}
          </button>
        </div>

        {!apiKeyConfigured && (
          <p className="notice notice--warn">
            No SmartSpectra API key found. Add <code>SMARTSPECTRA_API_KEY</code> to{' '}
            <code>.env</code> (see README) to enable the camera mode. You can still practise without
            it.
          </p>
        )}

        <p className="muted small">{questionCount} questions loaded · one session at a time</p>
      </section>
    </main>
  );
}
