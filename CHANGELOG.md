# Changelog

All notable changes to `@polygonlabs/oms-wallet-react-native` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-07-15

### Added
- Added the `OMSWallet` root client with wallet and indexer sub-clients aligned to the Swift and Kotlin SDKs.
- Added email, OIDC ID-token, and OIDC redirect authentication with automatic or manual wallet selection.
- Added session state and expiration events, wallet management, signing and verification, transactions, access management, balances, and transaction history.
- Added bare React Native and Expo development-build guidance, native Google ID-token examples, and native autolinking checks.

### Changed
- Renamed the npm package to `@polygonlabs/oms-wallet-react-native`.
- Updated the native Swift and Kotlin dependencies to `0.2.0`.
- Renamed public wallet records to `WalletAccount` and normalized absent JavaScript values to `undefined`.
- Aligned public result unions, errors, networks, fee selection, and indexer models across Android and iOS.
- Changed the package license to Apache 2.0.

## [0.1.0-alpha.4] — 2026-06-26

### Changed
- Lowered the Android OMS SDK requirement to `minSdk 24`.
- Aligned Android Kotlin, coroutine, and serialization versions with current
  React Native and Expo defaults.
- Updated the iOS OMS SDK dependency to `0.1.0-alpha.4`.
- Aligned iOS promise rejection metadata with the current native error contract.

### Fixed
- Expo and bare React Native apps can use the standard Android build
  requirements for OMS.

## [0.1.0-alpha.3] — 2026-06-26

### Added
- Support for Android and iOS OMS SDK `0.1.0-alpha.3`.
- `OMSClient` class API with `wallet`, `indexer`, and synchronous `supportedNetworks`.
- Public wallet APIs for OIDC ID-token sign-in, redirect auth, wallet selection, session state,
  signing, transaction submission, transaction status, ID tokens, access listing, and access revoke.
- Public indexer APIs for balances and transaction history.
- Public unit parsing and formatting helpers.

### Changed
- Updated transaction fee selection to use the native SDK fee option selection payload.
- Updated README and API reference for the current public TypeScript API.
- Updated SDK and Trails examples for the alpha.3 public API.

### Fixed
- Corrected supported network metadata URLs.
- Fixed Android fee option handling and transaction parameter bridging.
- Aligned CI dependency setup for iOS, Android, and Claude review workflows.

## [0.1.0-alpha.2] — 2026-06-10

### Added
- Support for Android and iOS OMS SDK `0.1.0-alpha.2`.
- Session expiry event handling with replay for late JS listeners.
- Session lifetime options for email and OIDC sign-in flows.
- OIDC redirect login hints.
- Standalone Expo example app.
- Native bridge test coverage.

### Changed
- Expanded SDK and Trails example apps with session controls and session expiry handling.
- Upgraded the React Native baseline to `0.85.3` and refreshed build/dev dependencies.
- Tightened published package contents to exclude generated example artifacts.

## [0.1.0-alpha.1] — 2025-05-27

### Added
- Initial alpha release of `@0xsequence/oms-react-native-sdk` (renamed from `oms-client-react-native-sdk`).
- TypeScript public API: `configure`, `startEmailAuth`, `completeEmailAuth`, `startOidcRedirectAuth`,
  `handleOidcRedirectCallback`, `getWalletAddress`, `signMessage`, `sendTransaction`,
  `getTokenBalances`, `formatUnits`, `parseUnits`.
- React Native Turbo Module bridging iOS (Swift `oms-client-swift-sdk`) and Android (Kotlin
  `oms-client-kotlin-sdk`).
- SDK example app and Trails actions demo with redirect auth and pagination.
- GitHub Actions CI: lint, typecheck, Android build, iOS build.
