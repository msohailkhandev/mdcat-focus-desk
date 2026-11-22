import type { ReactNode } from 'react';

import type { NudgeKind } from '@shared/types';

interface NudgePromptProps {
  readonly kind: NudgeKind;
  readonly onAccept: () => void;
  readonly onDismiss: () => void;
}

const COPY: Record<NudgeKind, { title: string; body: string }> = {
  elevated: {
    title: 'Your pulse has been up for a while.',
    body: 'That’s normal under exam pressure. Want a 32-second breathing reset? The timer pauses.',
  },
  fatigue: {
    title: 'You’ve barely blinked in a few minutes.',
    body: 'Screens do that. A quick pause to rest your eyes can help you read more accurately.',
  },
};

/**
 * A non-blocking offer, not an interruption: the question stays visible and
 * the student can keep working by dismissing it.
 */
export function NudgePrompt({ kind, onAccept, onDismiss }: NudgePromptProps): ReactNode {
  const copy = COPY[kind];
  return (
    <aside className="nudge" role="status" aria-live="polite">
      <strong>{copy.title}</strong>
      <p>{copy.body}</p>
      <div className="actions actions--tight">
        <button type="button" className="btn btn--primary btn--sm" onClick={onAccept}>
          Pause &amp; breathe
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss}>
          Keep going
        </button>
      </div>
    </aside>
  );
}
