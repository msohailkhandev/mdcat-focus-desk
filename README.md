# MDCAT Focus Desk

A consent-first practice-test desk for MDCAT students. With the student's permission, an ordinary
webcam (via the [Presage SmartSpectra SDK](https://smartspectra.presagetech.com/)) tracks how
composed they stay during a timed test. Afterwards it shows **which topics push their pulse up**,
not just which ones they got wrong.

> Built for the [DEV Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).
> This is a study companion, **not** a medical device. It makes no diagnosis and gives no health advice.

## What it does

1. **Consent.** A plain-language screen explains exactly what is measured, stored and sent. Nothing
   starts until the student agrees. There is also a full "without camera" mode.
2. **Baseline.** 30 seconds of resting pulse and breathing, measured on-device. Everything later is
   compared against the student's _own_ baseline, not a population norm.
3. **Timed test.** MDCAT-style MCQs, about 65 seconds each. Live numbers are deliberately hidden. If
   pulse or breathing stay above baseline for roughly 20 seconds, a small, non-blocking nudge offers
   a 32-second box-breathing pause. If blink rate drops for a few minutes, it offers an eye rest. The
   timer pauses during the break, and the student can always decline.
4. **Verified breathing pause.** The pause overlay listens to the live breathing signal and only
   confirms "your breathing has slowed" when it actually has. If the signal is poor, it says nothing.
5. **Report.** Accuracy and a _composure score_ per topic, with "pressure points": the topics where
   the student was noticeably less composed than their session average.

## Live SmartSpectra signals used

| Signal            | Metric                   | How it's used                                      |
| ----------------- | ------------------------ | -------------------------------------------------- |
| Pulse rate        | `cardio.pulseRate`       | Baseline and sustained-elevation detector          |
| Breathing rate    | `breathing.rate`         | Baseline, elevation detector, pause verification   |
| Blink detection   | `face.blinking`          | Blink-rate fatigue nudge                           |
| Validation status | `validationStatus` event | Gates every sample; unreliable readings never vote |

Readings below the SDK's own accuracy floor (`stable === false`) are ignored everywhere.

## Requirements

- **Windows 10/11 (x64)** or **macOS on Apple Silicon (M1 to M4)**. Also runs on Linux x64/arm64.
  Intel Macs are **not** supported by the SmartSpectra SDK.
- **Node.js 20+** (22 recommended) and **git**.
- A free **SmartSpectra API key**: <https://physiology.presagetech.com/auth/register>.
  This is optional, since the app also runs in a full "without camera" mode with no key.

## Setup

```bash
git clone https://github.com/<you>/mdcat-focus-desk.git
cd mdcat-focus-desk
npm install
cp .env.example .env        # then put your key in SMARTSPECTRA_API_KEY=
npm run dev
```

On **macOS**, make sure you are on Node 22 first (`nvm use 22` if you use nvm).
On **Windows**, use PowerShell or Git Bash.

`npm install` downloads the SDK's native runtime for every supported platform (a few hundred MB).
Only the one matching your machine is loaded.

No login is required. Without an API key the app still runs in a full **"without camera"** mode.
On the calibration screen, press **Ctrl+D** for a live diagnostics panel (real pulse, breathing and
frame rate). This is handy for confirming the SmartSpectra signal is live.

### Scripts

| Command               | What it does                                                  |
| --------------------- | ------------------------------------------------------------- |
| `npm run dev`         | Start in development with hot reload                          |
| `npm run check`       | Prettier, ESLint (type-aware, strict), `tsc`, and Vitest      |
| `npm run test`        | Unit tests for the composure engine and session flow          |
| `npm run build`       | Production build into `out/`                                  |
| `npm run package:win` | Windows installer (.exe) via electron-builder, run on Windows |
| `npm run package:mac` | macOS installer (.dmg) via electron-builder, run on macOS     |

## Architecture

```
src/
  main/        Electron main process: window, CSP, camera-only permission handler,
               SmartSpectra IPC binding, local JSON session store
  preload/     contextBridge: typed window.api plus the SDK's MessagePort bridge
  renderer/    React UI (screens, components) plus a thin SmartSpectra client wrapper
  shared/      Pure, dependency-free domain logic (fully unit-tested):
    composure/   BaselineCalibrator, ElevationDetector, BlinkFatigueDetector,
                 QuestionComposureAccumulator, metrics adapter
    session/     TestSession orchestrator (clock-agnostic)
    report/      per-topic aggregation and pressure points
```

Design rules the code enforces:

- **No number without confidence.** A packet with no new sample leaves the field `undefined`, and
  `null`/`undefined` is never displayed or treated as zero.
- **No single-sample decisions.** Nudges need sustained elevation across most of a 20-second window,
  followed by a 3-minute cooldown.
- **Drop-outs don't vote.** Head movement or looking away produces no readings, which count as
  neither calm nor elevated.
- **Domain logic is pure.** Everything under `src/shared` takes time as a parameter and has no
  React, Electron or SDK imports.

See [PRIVACY.md](PRIVACY.md) for consent and data handling, and [CONTRIBUTING.md](CONTRIBUTING.md)
for code standards.

## Adding questions

Edit `src/renderer/src/data/questions.sample.json`. Each entry needs `id`, `subject` (one of
Biology, Chemistry, Physics, English, Logical Reasoning), `topic`, `stem`, exactly four `options`,
and `answerIndex` (0 to 3). The bank is validated at startup and fails loudly on mistakes.

## Beyond MDCAT

The composure engine is exam-agnostic. Nothing about the baseline, elevation detection, breathing
pause or per-topic report is specific to MDCAT. The test is driven entirely by a question bank
(`src/renderer/src/data/questions.sample.json`) tagged with `subject` and `topic`.

Swap that one file and the same app works for any high-stakes MCQ exam where staying composed
matters: NUMS, FCPS/NRE, the CSS written exam, NTS/HAT, university entry tests, or technical
interview drills. MDCAT is simply the first question set, because that is the audience this is
built for.

## License

MIT. See [LICENSE](LICENSE). The SmartSpectra SDK is proprietary to Presage Technologies and is
used under its own license via npm.
