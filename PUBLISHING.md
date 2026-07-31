# Publishing

> Publishing is CI-only. Never run `changeset version`, `changeset publish`, `npm publish`, or
> `yarn npm publish` locally for a real release. Local publishing bypasses required verification,
> signed release commits, and npm OIDC trusted-publishing provenance.

Releases are driven by Changesets. The only publishable package is the repository-root
`@polygonlabs/oms-wallet-react-native`; the example workspaces are private and are never versioned
or tagged.

## Day-to-day changesets

Every pull request must include a changeset:

```sh
yarn changeset
```

Choose the SemVer bump that matches the React Native package's public impact and write a
user-facing changelog entry. Use an empty changeset when the pull request changes only
documentation, CI, tooling, or examples:

```sh
yarn changeset add --empty
```

Commit the changeset with the rest of the pull request. The Changeset check blocks pull requests
that omit it.

## Automated release flow

1. Merge changes, including their changesets, into `master`.
2. After JavaScript, package, Expo, Android, and iOS verification succeeds, the Release workflow
   opens or updates `chore(release): publish package`.
3. Review and merge that release pull request.
4. The same workflow verifies the release commit, publishes through npm OIDC trusted publishing,
   creates the signed `v<version>` tag, and creates the GitHub Release from `CHANGELOG.md`.
5. After publication, the workflow opens a follow-up pull request that updates the standalone Expo
   example to the registry-published version and refreshes its npm lockfile.

The release workflow uses a GitHub App token and Changesets' `github-api` commit mode. Release
commits and follow-up Expo commits must remain GitHub-verified; do not fall back to unsigned local
commits.

## Native dependency version policy

The npm wrapper version is independent of the native SDK version:

- `android/build.gradle` and `OmsWalletReactNativeSdk.podspec` normally pin the same native SDK
  version.
- A native SDK bump requires confirming that both Maven Central and CocoaPods artifacts exist,
  running Android and iOS builds, and adding a changeset based on the React Native consumer impact.
- React Native-only changes may release npm without changing either native dependency.
- Release automation never changes native dependency versions.
- Any intentional Swift/Kotlin version divergence requires explicit approval and documentation.

## Local release-readiness checks

Use local dry runs only:

```sh
yarn install --immutable
yarn verify
yarn check:package
yarn expo-example:install
npm --prefix examples/expo-example run typecheck
yarn expo-example:prebuild
yarn expo-example:verify-autolinking
```

Native Android and iOS builds run in CI. Do not publish when any required check is failing.

## Snapshot releases

The Release workflow can publish a throwaway snapshot under a non-semver npm dist-tag:

1. Open GitHub Actions → Release → Run workflow.
2. Enter a tag such as `canary` or `pre-0.3.0`.

Snapshots version only the runner state, publish through OIDC, and skip git tags, GitHub Releases,
and Expo follow-up pull requests. SemVer-shaped snapshot tags are rejected.

## External configuration

The npm package must trust the exact release workflow:

- Organization: `0xPolygon`
- Repository: `oms-wallet-react-native-sdk`
- Workflow: `release.yml`
- Allowed operation: `npm publish`

The repository also needs access to `CHANGESET_RELEASE_BOT_APP_ID` and
`CHANGESET_RELEASE_BOT_APP_PRIVATE_KEY`. No long-lived `NPM_TOKEN` is used.
