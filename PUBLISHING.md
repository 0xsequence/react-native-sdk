# Publishing

Release process for `@0xsequence/oms-react-native-sdk`.

Only maintainers with npm publish access should publish. Publish from `master` after CI is green.

## 1. Choose The Version

Use an exact semantic version. Add an `-alpha.N` suffix only for a prerelease.

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
  - `OmsWalletReactNativeSdk.podspec`
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
yarn expo-example:install
yarn verify
npm --prefix examples/expo-example run typecheck
yarn sdk-example build:android
yarn sdk-example build:ios
```

Do not publish if any command fails. `yarn expo-example:install` packs the local SDK source so the
standalone Expo example is checked against the release candidate.

If native SDK versions changed, confirm those versions are already available from Maven Central and
CocoaPods before merging the release PR.

## 4. Dry Run

Build the package and inspect what npm would publish:

```sh
yarn prepare
yarn npm publish --dry-run --access public
```

The dry run should include `lib`, `src`, `android`, `ios`, and
`OmsWalletReactNativeSdk.podspec`.

## 5. Publish

Confirm the npm account, then publish:

```sh
yarn npm whoami
yarn npm publish --access public
```

Add `--tag alpha` to both commands only for an alpha release. Stable releases publish to `latest`.

## 6. Confirm

Verify npm sees the published version:

```sh
npm view @0xsequence/oms-react-native-sdk@<version> version dist.integrity
```

## 7. Tag The Release

From the same clean `master` commit used for the npm publication, create and push a signed tag:

```sh
VERSION=$(node -p "require('./package.json').version")
git status --short
git tag -s "v$VERSION" -m "v$VERSION"
git push origin "v$VERSION"
gh release create "v$VERSION" --verify-tag --generate-notes
```

Stop if the working tree is not clean or commit/tag signing is unavailable. Do not tag a later
post-publication commit.

## 8. Update The Expo Example

Update the standalone Expo example to the newly published npm tarball:

```sh
yarn expo-example:install:published
```

Commit the updated `examples/expo-example/package.json` and
`examples/expo-example/package-lock.json`. This happens after publication because npm cannot
produce a valid registry lock entry for an unpublished version.

If the package should become the default install later, move the npm dist-tag deliberately in a
separate step.
