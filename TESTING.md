# TESTING.md

How testing works in this repo. `AGENTS.md` points here so agents know how to verify changes.

## Current state

The repo has a focused unit test suite for JavaScript bridge behavior. The suite uses Node's
built-in test runner against the generated CommonJS package output, so `yarn test` runs
`yarn prepare` first and then executes `test/*.test.js`.

Native device/simulator verification is still manual unless called out by a specific change.

---

## Manual verification checklist

Run these before merging any change:

```bash
# Lint and formatting
yarn lint

# TypeScript type-check (library)
yarn typecheck

# Unit tests
yarn test

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

## Test setup

- **Unit tests** — JavaScript bridge and pure TypeScript behavior in `src/`.
  - Runner: Node's built-in `node:test`.
  - Location: `test/*.test.js`.
  - Command: `yarn test`.
  - Current native bridge tests mock `lib/commonjs/NativeOmsClientReactNativeSdk.js` after
    `yarn prepare`, then import `lib/commonjs/client.native.js`.

- **Integration tests** — tests that exercise the native bridge on a real device or simulator.
  These require a connected device/emulator and valid OMS credentials. Not expected to run in
  standard CI; run manually before release.

---

## Conventions

- Name unit test files `*.test.js` under `test/` unless the project adopts a TypeScript-aware
  test runner later.
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
| Run unit tests              | `yarn test`                                  |
| Full CI equivalent          | `yarn lint && yarn typecheck && yarn test`   |
