# TESTING.md

How testing works in this repo. `AGENTS.md` points here so agents know how to verify changes.

## Current state

**No automated test suite exists yet.** The repo is in early alpha (`0.1.0-alpha.1`). Until a test
runner is set up, verification is manual (see checklist below).

When tests are added, this file should be updated with the runner, locations, and commands.

---

## Manual verification checklist

Run these before merging any change:

```bash
# Lint and formatting
yarn lint

# TypeScript type-check (library)
yarn typecheck

# TypeScript type-check (Expo example)
npm --prefix examples/expo-example ci
npm --prefix examples/expo-example run typecheck

# Build the library
yarn prepare
```

Native builds (Android + iOS) run automatically in CI for pull requests and pushes to `master`. If
you changed the native layer (anything in `android/`, `ios/`, or the `.podspec`), make sure the
Android and iOS CI checks pass before merging; validate locally when you need faster feedback.

---

## Planned test setup

When automated tests are introduced, the intended split is:

- **Unit tests** — pure TypeScript functions in `src/` (e.g. `formatUnits`, `parseUnits`,
  `oidcProviders`). No native bridge, no device. Target runner: Jest or Vitest.
  - Location: `src/__tests__/` or co-located `*.test.ts` files.
  - Command (proposed): `yarn test`

- **Integration tests** — tests that exercise the native bridge on a real device or simulator.
  These require a connected device/emulator and valid OMS credentials. Not expected to run in
  standard CI; run manually before release.

---

## Conventions (for when tests are added)

- Name unit test files `*.test.ts` (co-located next to source) or place them in `src/__tests__/`.
- Every bug fix should include a regression test.
- Every new exported function should have at least one happy-path unit test.
- Keep unit tests free of native-bridge calls — mock `NativeOmsClientReactNativeSdk` at the module
  boundary.

---

## Execution summary

| Goal                        | Command                                      |
|-----------------------------|----------------------------------------------|
| Lint                        | `yarn lint`                                  |
| Typecheck (library)         | `yarn typecheck`                             |
| Typecheck (Expo example)    | `npm --prefix examples/expo-example run typecheck` |
| Build library               | `yarn prepare`                               |
| Run unit tests *(planned)*  | `yarn test`                                  |
| Full CI equivalent          | `yarn lint && yarn typecheck && yarn prepare` |
