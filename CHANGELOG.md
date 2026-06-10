# Changelog

All notable changes to `@0xsequence/oms-react-native-sdk` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
