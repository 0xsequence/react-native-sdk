# Changelog

All notable changes to `@0xsequence/oms-react-native-sdk` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0-alpha.1] — 2025-05-27

### Added
- Initial alpha release of `@0xsequence/oms-react-native-sdk` (renamed from `oms-client-react-native-sdk`).
- TypeScript public API: `configure`, `startEmailAuth`, `completeEmailAuth`, `startOidcRedirectAuth`,
  `handleOidcRedirectCallback`, `getWalletAddress`, `signMessage`, `sendTransaction`,
  `getTokenBalances`, `formatUnits`, `parseUnits`.
- React Native Turbo Module bridging iOS (Swift `oms-client-swift-sdk`) and Android (Kotlin
  `oms-client-kotlin-sdk`).
- SDK example app, Trails actions demo (with redirect auth + pagination), and standalone Expo
  example.
- GitHub Actions CI: lint, typecheck, Android build, iOS build.
