# @0xsequence/oms-react-native-sdk

React Native SDK for the OMS platform.

## Installation

```sh
npm install @0xsequence/oms-react-native-sdk
```

## Usage

```ts
import {
  completeEmailAuth,
  configure,
  formatUnits,
  getWalletAddress,
  handleOidcRedirectCallback,
  OidcProviders,
  parseUnits,
  sendTransaction,
  signMessage,
  startEmailAuth,
  startOidcRedirectAuth,
} from '@0xsequence/oms-react-native-sdk';

await configure({
  publishableKey: '<publishable-key>',
  projectId: '<project-id>',
});

await startEmailAuth('player@example.com');
const auth = await completeEmailAuth({ code: '<otp-code>' });

if (auth.type === 'walletSelection') {
  const selected = await auth.pendingSelection.selectWallet('<wallet-id>');
  console.log(selected.walletAddress);
} else {
  console.log(auth.walletAddress);
}

const signature = await signMessage('137', 'Hello from React Native');
const address = await getWalletAddress();
```

### OIDC Redirect Auth

The SDK exposes the low-level redirect methods. Apps own browser opening and
deep-link handling. Use a system auth browser such as Custom Tabs or
ASWebAuthenticationSession/SFAuthenticationSession; do not run provider OAuth in
an embedded WebView.

```ts
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

const started = await startOidcRedirectAuth({
  provider: OidcProviders.google(),
  redirectUri: 'com.example.app:/oauth/callback',
});

const browserResult = await InAppBrowser.openAuth(
  started.authorizationUrl,
  'com.example.app:/oauth/callback'
);

if (browserResult.type !== 'success') {
  throw new Error('OIDC sign-in was cancelled');
}

const result = await handleOidcRedirectCallback({
  callbackUrl: browserResult.url,
  walletSelection: 'manual',
});

if (result.type === 'walletSelection') {
  await result.pendingSelection.createAndSelectWallet();
}
```

### Fee Option Selection

```ts
const txResult = await sendTransaction({
  chainId: '137',
  to: '0xRecipient',
  value: '0',
  selectFeeOption: async (feeOptions) => {
    const selected =
      feeOptions.find((option) => option.availableRaw !== '0') ?? feeOptions[0];
    return selected ? selected.selection : null;
  },
});
```

`selectFeeOption` receives the same enriched fee options as the native SDKs:
`feeOption`, wallet `balance`, formatted `available`, raw `availableRaw`, and
`decimals`. Return `option.selection` for a quoted option; it preserves token IDs
when present and falls back to the token symbol for native fee options. Returning
`null` means no fee option is selected, which is only valid for sponsored
transactions.

### Unit Formatting

```ts
const raw = parseUnits('12.34', 6); // "12340000"
const formatted = formatUnits(raw, 6); // "12.34"
const rounded = parseUnits('1.235', 2, { roundingMode: 'nearest' }); // "124"
```

By default `parseUnits` rejects fractional precision beyond `decimals`.
Pass `{ roundingMode: 'nearest' }` when you want Kotlin-compatible rounding.

## API Reference

See [API.md](./API.md) for the public API surface and TypeScript shapes.

## Supported APIs

- Email OTP auth and OIDC ID-token auth
- Manual wallet selection for email, OIDC ID-token, and OIDC redirect auth
- Low-level OIDC redirect auth start/callback handling
- Session restore, sign-out, wallet address, and session metadata
- Wallet list, use existing wallet, and create wallet
- Supported network listing
- Message and typed-data signing and verification
- Transaction sending, custom fee-option selection, contract calls, and transaction status lookup
- Token balances and native token balance
- Wallet ID token retrieval
- Wallet access list, access-page iteration, single-page access lookup, and revoke access
- Unit parsing and formatting helpers

## Native SDK Dependencies

The React Native SDK owns its native SDK dependencies. Android resolves
`io.github.0xsequence:oms-client-kotlin-sdk:0.1.0-alpha.1` from Maven, and
iOS resolves `oms-client-swift-sdk` `0.1.0-alpha.1` from CocoaPods.

The React Native wrapper itself is distributed through npm. React Native
autolinking consumes the wrapper podspec and Android project from
`node_modules`.

Example apps should depend on `@0xsequence/oms-react-native-sdk`, not directly
on the underlying native SDKs.

## Consumer Requirements

- Bare React Native apps are supported through normal React Native autolinking.
- Expo apps must use a development build, Expo prebuild/EAS Build, or the bare
  workflow. Expo Go cannot load this SDK because it includes custom native code.
- Android apps need `minSdk 26`, `compileSdk 34` or newer, and Java 17 compile
  options.
- iOS apps need deployment target 15.0 or newer.
- OIDC redirect auth requires the consuming app to configure its own URL scheme
  or app links.

## Examples

- `examples/sdk-example` is the bare React Native SDK demo.
- `examples/trails-actions-example` is the bare React Native demo for OMS wallet
  flow with Trails action resolution.
- `examples/expo-example` is a standalone Expo development-build demo that uses
  `expo-web-browser` and the published npm package. It is intentionally
  excluded from the root Yarn workspace so it is not linked to the local SDK
  source.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)

## Publishing (for `alpha`)

Publish from a clean worktree. The Android and iOS native SDK dependencies are
resolved from Maven Central and CocoaPods by Gradle and CocoaPods; the React
Native wrapper podspec is shipped in the npm package and consumed from
`node_modules` by React Native autolinking.

Before publishing a new release, update `package.json` with the target npm
version and make sure that exact version has not already been published:

```sh
npm view @0xsequence/oms-react-native-sdk@<version> version
```

An npm 404 means that version is available. If npm prints a version, choose a
new version before publishing.

Then verify and publish:

```sh
git status --short
yarn typecheck
yarn lint
yarn prepare
yarn sdk-example build:android
yarn sdk-example build:ios
yarn npm publish --dry-run --access public --tag alpha
yarn npm publish --access public --tag alpha
```

The dry-run should include `lib`, `src`, `android`, `ios`, and
`OmsClientReactNativeSdk.podspec`.
