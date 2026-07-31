# Changesets

Every pull request must include a changeset.

Use `yarn changeset` for a consumer-facing change to
`@polygonlabs/oms-wallet-react-native`. Choose the SemVer bump that matches the public impact and
write a user-facing summary.

Use `yarn changeset add --empty` for documentation, CI, tooling, or example-only changes that do
not change the published package.

The automated release workflow consumes changesets, updates the root package version and
`CHANGELOG.md`, publishes through npm trusted publishing, and creates the `v<version>` tag and
GitHub Release.
