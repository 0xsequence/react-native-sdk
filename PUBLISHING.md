# Publishing

Release process for `@0xsequence/oms-react-native-sdk`.

Only maintainers with npm publish access should publish. Publish from `master` after CI is green.

## 1. Choose The Version

Pre-release versions use `0.x.y-alpha.N`, for example `0.1.0-alpha.3`.

Check that the version is not already published:

```sh
npm view @0xsequence/oms-react-native-sdk@<version> version
```

An npm 404 means the version is available. If npm prints a version, choose a new version.

## 2. Prepare The Release Commit

Update:

- `package.json` `version`
- `CHANGELOG.md`
- native SDK references if they changed:
  - `android/build.gradle`
  - `OmsClientReactNativeSdk.podspec`
  - `README.md`
  - `API.md`

Install after editing package metadata:

```sh
yarn install
```

Commit the release changes before publishing.

## 3. Verify

Run the standard checks from a clean worktree:

```sh
git status --short
yarn lint
yarn typecheck
yarn test
yarn sdk-example build:android
yarn sdk-example build:ios
```

Do not publish if any command fails. If native SDK versions changed, confirm those versions are
already available from Maven Central and CocoaPods.

## 4. Dry Run

Build the package and inspect what npm would publish:

```sh
yarn prepare
yarn npm publish --dry-run --access public --tag alpha
```

The dry run should include `lib`, `src`, `android`, `ios`, and
`OmsClientReactNativeSdk.podspec`.

## 5. Publish

Confirm the npm account, then publish:

```sh
yarn npm whoami
yarn npm publish --access public --tag alpha
```

Use `--tag alpha` for alpha releases so prereleases do not become the default `latest` install.

## 6. Confirm

Verify npm sees the published version:

```sh
npm view @0xsequence/oms-react-native-sdk@<version> version
```

If the release updates APIs used by the standalone Expo example, update
`examples/expo-example` to depend on the newly published npm version after npm
confirms it is available.

If the package should become the default install later, move the npm dist-tag deliberately in a
separate step.
