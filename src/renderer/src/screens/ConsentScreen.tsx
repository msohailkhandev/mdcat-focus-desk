import { useState, type ReactNode } from 'react';

interface ConsentScreenProps {
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

/**
 * Explicit, specific consent before the camera is touched.
 *
 * Everything the app does with camera data is stated here in plain language.
 * The wording is mirrored in PRIVACY.md so what the student reads and what
 * the code does cannot drift apart silently.
 */
export function ConsentScreen({ onAccept, onDecline }: ConsentScreenProps): ReactNode {
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="screen screen--center">
      <section className="card card--narrow">
        <p className="eyebrow">Before the camera turns on</p>
        <h2>What the camera is used for</h2>

        <dl className="facts">
          <dt>What is measured</dt>
          <dd>
            Pulse rate, breathing rate and blink detection, estimated from tiny colour and motion
            changes in your face and chest. These are computed on this computer by the Presage
            SmartSpectra SDK.
          </dd>

          <dt>What is stored</dt>
          <dd>
            Only per-question summaries (e.g. “pulse was 12 bpm above your resting level on question
            7”) are saved, in a local file on this computer. No images, no video, no raw signal
            traces.
          </dd>

          <dt>What is sent anywhere</dt>
          <dd>
            Nothing from you. SDK telemetry is switched off in this app. The SDK contacts Presage to
            validate the API key and meter usage; per Presage’s documentation this carries no camera
            frames and no vital-sign measurements.
          </dd>

          <dt>How to stop or delete</dt>
          <dd>
            End the test at any time with the “End test” button, the camera stops immediately.
            Delete all saved sessions from the Past sessions screen.
          </dd>

          <dt>What this is not</dt>
          <dd>
            Not a medical device, not a diagnosis, not health advice. It is a study aid that reacts
            to your own resting baseline, measured at the start of each session.
          </dd>
        </dl>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
            }}
          />
          <span>
            I understand and agree to the camera being used as described for this session.
          </span>
        </label>

        <div className="actions">
          <button type="button" className="btn btn--primary" disabled={!agreed} onClick={onAccept}>
            Turn on camera and continue
          </button>
          <button type="button" className="btn" onClick={onDecline}>
            Continue without camera
          </button>
        </div>
      </section>
    </main>
  );
}
