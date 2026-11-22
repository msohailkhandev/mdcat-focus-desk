# Contributing

Thanks for taking a look. This project is small and opinionated; the rules below keep it that way.

## Setup

```bash
npm install
cp .env.example .env   # add your SmartSpectra key
npm run dev
```

`npm install` also installs Husky hooks: `lint-staged` runs on every commit and commit messages
must follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
`docs:`, `refactor:`, `test:`, `chore:`).

## Before you open a PR

```bash
npm run check   # prettier + eslint + tsc + vitest, all must pass
```

CI runs the same command plus a production build.

## Code standards

- **TypeScript strict**, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on.
  Don't reach for `any` or `!`; model the uncertainty instead.
- **Domain logic lives in `src/shared`** and must stay pure: no React, Electron or SDK imports,
  and time is always passed in as a parameter. Every behaviour change there needs a test.
- **Renderer code never talks to Node or the SDK main process directly**, only through the typed
  `window.api` bridge and the SDK's renderer entry point.
- **Never display a reading the SDK didn't mark as stable.** See `isConfident()` and the
  `valid` flag on `VitalsSample`.
- **Privacy claims must match code.** If you change what is measured, stored or sent, update both
  `ConsentScreen.tsx` and `PRIVACY.md` in the same PR.
- Prefer small, named functions and explanatory doc comments over clever one-liners.

## Scope

Things that are welcome: better question banks, accessibility improvements, calibration of the
nudge thresholds backed by reasoning, and packaging fixes.

Things that are out of scope: anything that turns this into a health or diagnostic tool, cloud
sync of measurements, or any covert/background capture mode.
