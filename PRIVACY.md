# Consent and Data Handling

This document mirrors the consent screen inside the app (`src/renderer/src/screens/ConsentScreen.tsx`).
If the two ever disagree, that is a bug, please open an issue.

## Consent

- The camera is **never** turned on before the student reads the consent screen and ticks the
  agreement checkbox. "Start without camera" is always available and is a full, working mode.
- While the camera is on, a live preview is always visible on screen. There is no background or
  hidden capture mode.
- "End test" stops the camera immediately. Closing the window releases it.

## What is measured

Pulse rate, breathing rate and blink detection, estimated by the Presage SmartSpectra SDK from
colour and motion changes in the face and upper chest. Processing happens on the student's
computer.

## What is stored

Only per-question **summaries**, in a single JSON file in the OS user-data directory
(`%APPDATA%/mdcat-focus-desk/sessions.json` on Windows):

- mean pulse delta and mean breathing delta versus the session baseline, per question;
- seconds the elevation detector considered the student "elevated", per question;
- a 0-100 composure score per question;
- which nudges were offered and whether they were accepted;
- the session's baseline pulse and breathing rate.

**Not stored:** images, video, raw waveforms, per-sample readings, facial landmarks.

## What is sent

Nothing from the student. The SmartSpectra SDK contacts Presage's servers once per session to
validate the API key and meter usage. According to Presage's documentation, that request carries
no frames and no measured vitals. This app sets `enableTelemetry: false`, which disables the SDK's
optional session-summary telemetry.

This app has no analytics, no crash reporting and no network calls of its own. The renderer's
Content Security Policy blocks all external connections.

## Retention and deletion

Sessions are kept until the student deletes them. "Past sessions → Delete all sessions"
permanently removes the file. Uninstalling the app does not automatically delete the user-data
directory; delete it manually if desired.

## Optional AI services

None. The SDK's LLM Insights feature is not used.

## What this is not

Not a medical device. Not a diagnosis. Not health advice. SDK metrics are for general wellness and
informational purposes only and are not FDA-cleared. The composure score is a comparison against the
student's own resting baseline from the start of that session and nothing more.

## Minors

MDCAT candidates are typically 17-20. The app collects no identity, account or contact details and
stores nothing that identifies a person. Parents or guardians of younger students should review
this document with them before use.
