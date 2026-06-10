# Contributing

## Prerequisites

- Node.js v24.13.0 (use `.nvmrc` — `nvm use` or `fnm use`)
- Yarn 4 (`corepack enable` then `yarn --version`)
- For Android builds: Android SDK, `ANDROID_HOME` set
- For iOS builds: Xcode, CocoaPods, Ruby (`bundle install` inside the example)

## Setup

```bash
git clone https://github.com/0xsequence/react-native-sdk.git
cd react-native-sdk
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
| `examples/expo-example/` | Expo example — **not** a Yarn workspace; use `npm` here |

## Development workflow

```bash
yarn lint           # ESLint + Prettier check
yarn typecheck      # tsc
yarn prepare        # rebuild lib/ after src/ changes

# Run the SDK example
yarn sdk-example start

# Run the Expo example (uses npm, not yarn)
cd examples/expo-example && npm install && npm start
```

## Before opening a PR

1. `yarn lint && yarn typecheck && yarn prepare` must pass cleanly.
2. Update `API.md` if you changed public exports in `src/index.tsx`.
3. Update `TESTING.md` if you added or changed test commands.
4. If you changed the native layer (`android/`, `ios/`, `.podspec`), note it in the PR and make
   sure the Android and iOS CI checks pass before merging.
5. PR title must follow [Conventional Commits](https://www.conventionalcommits.org), e.g. `fix(auth): handle expired OTP correctly`.

## Publishing (alpha)

Publishing steps are documented in `PUBLISHING.md`. Only maintainers with npm publish access should
publish.

## Signed commits

This repo requires signed commits. Configure `gpg` or SSH signing in your local git config before
contributing.
