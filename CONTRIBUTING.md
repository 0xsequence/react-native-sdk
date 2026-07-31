# Contributing

## Prerequisites

- Node.js v24.13.0 (use `.nvmrc` — `nvm use` or `fnm use`)
- Yarn 4 (`corepack enable` then `yarn --version`)
- For Android builds: Android SDK, `ANDROID_HOME` set
- For iOS builds: Xcode, CocoaPods, Ruby (`bundle install` inside the example)

## Setup

```bash
git clone https://github.com/0xPolygon/oms-wallet-react-native-sdk.git
cd oms-wallet-react-native-sdk
yarn install
yarn prepare        # build lib/
```

## Repo structure

| Path | Purpose |
|---|---|
| `src/` | TypeScript public API and Turbo Module bindings |
| `lib/` | Built output — generated, do not edit directly |
| `android/` | Kotlin native module |
| `ios/` | ObjC/Swift native module |
| `examples/sdk-example/` | React Native CLI example (Yarn workspace) |
| `examples/trails-actions-example/` | Trails demo (Yarn workspace) |
| `examples/expo-example/` | Expo example — **not** a Yarn workspace; install with `yarn expo-example:install` from the repo root |

## Development workflow

```bash
yarn lint           # ESLint + Prettier check
yarn typecheck      # tsc
yarn prepare        # rebuild lib/ after src/ changes

# Run the SDK example
yarn sdk-example start

# Run the Expo example
yarn expo-example:install
yarn expo-example
```

## Before opening a PR

1. `yarn lint && yarn typecheck && yarn prepare` must pass cleanly.
2. Add a user-facing changeset with `yarn changeset`, or an empty changeset with
   `yarn changeset add --empty` for documentation, CI, tooling, or example-only changes.
3. Update `API.md` if you changed public exports in `src/index.tsx`.
4. Update `TESTING.md` if you added or changed test commands.
5. If you changed the native layer (`android/`, `ios/`, `.podspec`), note it in the PR and make
   sure the Android and iOS CI checks pass before merging.
6. PR title and commits must follow [Conventional Commits](https://www.conventionalcommits.org),
   e.g. `fix(auth): handle expired OTP correctly`.

## Publishing

Publishing is CI-only and driven by Changesets. See `PUBLISHING.md`; never publish a real release
from a local machine.

## Signed commits

This repo requires signed commits. Configure `gpg` or SSH signing in your local git config before
contributing.
