# @0xsequence/oms-react-native-sdk

React Native SDK for the OMS platform.

## Installation

```sh
npm install @0xsequence/oms-react-native-sdk
```

## Usage

```ts
import { OMSClient } from '@0xsequence/oms-react-native-sdk';

const oms = new OMSClient({
  publishableKey: '<publishable-key>',
});

await oms.wallet.startEmailAuth('player@example.com');
const auth = await oms.wallet.completeEmailAuth({ code: '<otp-code>' });

if (auth.type === 'walletSelection') {
  const selected = await auth.pendingSelection.selectWallet('<wallet-id>');
  console.log(selected.walletAddress);
} else {
  console.log(auth.walletAddress);
}

const signature = await oms.wallet.signMessage(
  '137',
  'Hello from React Native'
);
const address = await oms.wallet.getWalletAddress();
```

### OIDC Redirect Auth

Apps own browser opening and deep-link handling. Use a system auth browser such
as Custom Tabs or ASWebAuthenticationSession/SFAuthenticationSession; do not run
provider OAuth in an embedded WebView.

```ts
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import { OidcProviders } from '@0xsequence/oms-react-native-sdk';

const started = await oms.wallet.startOidcRedirectAuth({
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

const result = await oms.wallet.handleOidcRedirectCallback({
  callbackUrl: browserResult.url,
  walletSelection: 'manual',
});

if (result.type === 'walletSelection') {
  await result.pendingSelection.createAndSelectWallet();
}
```

### Indexer

```ts
const polygon = oms.supportedNetworks.find(
  (network) => network.chainId === '137'
);

const balances = await oms.indexer.getBalances({
  walletAddress: address!,
  networks: polygon ? [polygon] : undefined,
  includeMetadata: true,
});

const history = await oms.indexer.getTransactionHistory({
  walletAddress: address!,
  networks: polygon ? [polygon] : undefined,
});
```

`getBalances` returns `nativeBalances` separately from token-contract
`balances`.

### Fee Option Selection

```ts
const txResult = await oms.wallet.sendTransaction({
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
`decimals`. Return `option.selection` for a quoted option.

### Unit Formatting

```ts
import { formatUnits, parseUnits } from '@0xsequence/oms-react-native-sdk';

const raw = parseUnits('12.34', 6); // "12340000"
const formatted = formatUnits(raw, 6); // "12.34"
const rounded = parseUnits('1.235', 2); // "124"
```

By default `parseUnits` rounds fractional precision beyond `decimals` to the
nearest base unit, matching the native SDKs. Pass `{ roundingMode: 'reject' }`
to fail on non-zero excess precision.

## API Reference

See [API.md](./API.md) for the public API surface and TypeScript shapes.

## Supported APIs

- Email OTP auth, OIDC ID-token auth, and OIDC redirect auth
- Manual wallet selection
- Session restore, sign-out, wallet address, and session metadata
- Wallet list, use existing wallet, and create wallet
- Synchronous supported network list via `oms.supportedNetworks`
- Message and typed-data signing and verification
- Transaction sending, custom fee-option selection, contract calls, and transaction status lookup
- Indexer balances and transaction history
- Wallet ID token retrieval
- Wallet access list, access-page iteration, single-page access lookup, and revoke access
- Unit parsing and formatting helpers

## Native SDK Dependencies

The React Native SDK owns its native SDK dependencies. Android resolves
`io.github.0xsequence:oms-client-kotlin-sdk:0.1.0-alpha.4` from Maven, and iOS
resolves `oms-client-swift-sdk` `0.1.0-alpha.4` from CocoaPods.

The React Native wrapper itself is distributed through npm. React Native
autolinking consumes the wrapper podspec and Android project from
`node_modules`.

Example apps should depend on `@0xsequence/oms-react-native-sdk`, not directly
on the underlying native SDKs.

## Consumer Requirements

- Bare React Native apps are supported through normal React Native autolinking.
- Expo apps must use a development build, Expo prebuild/EAS Build, or the bare
  workflow. Expo Go cannot load this SDK because it includes custom native code.
- Android builds need `minSdk 24`, `compileSdk 34` or newer, and Java 17 compile
  options.
- Supported Android devices need Android 10 / API 29 or newer.
- iOS apps need deployment target 15.0 or newer.
- OIDC redirect auth requires the consuming app to configure its own URL scheme
  or app links.

## Examples

- `examples/sdk-example` is the bare React Native SDK demo.
- `examples/trails-actions-example` is the bare React Native demo for OMS wallet
  flow with Trails action resolution.
- `examples/expo-example` is a standalone Expo development-build demo that uses
  `expo-web-browser` and the npm package. It is intentionally excluded from the
  root Yarn workspace so it is not linked to the local SDK source.

## Publishing

See [PUBLISHING.md](./PUBLISHING.md) for the release process.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
