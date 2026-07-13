# @0xsequence/oms-react-native-sdk

React Native SDK for OMS Wallet.

## Installation

```sh
npm install @0xsequence/oms-react-native-sdk
```

The package contains native code. Bare React Native apps can use autolinking. Expo apps require a development build, prebuild, or EAS Build; Expo Go is not supported.

## Create A Wallet Client

```ts
import { OMSWallet } from '@0xsequence/oms-react-native-sdk';

const omsWallet = new OMSWallet({
  publishableKey: '<publishable-key>',
});
```

## Authenticate

For email authentication, request a code and complete authentication with the code the user receives:

```ts
await omsWallet.wallet.startEmailAuth('player@example.com');

const auth = await omsWallet.wallet.completeEmailAuth({
  code: '<otp-code>',
});

if (auth.type === 'walletSelection') {
  await auth.pendingSelection.selectWallet(auth.wallets[0]!.id);
}
```

For mobile OIDC integrations, obtain an ID token with the provider's native SDK and pass it to OMS Wallet:

```ts
await omsWallet.wallet.signInWithOidcIdToken({
  idToken,
  issuer: 'https://accounts.google.com',
  audience: '<google-client-id>',
  provider: 'google',
  providerLabel: 'Google',
});
```

OMS relay providers are available for redirect authentication. The app owns browser presentation and callback handling:

```ts
import {
  OmsRelayOidcProviders,
} from '@0xsequence/oms-react-native-sdk';

const callbackUri = 'com.example.app://auth/callback';
const started = await omsWallet.wallet.startOidcRedirectAuth({
  provider: OmsRelayOidcProviders.google,
  omsRelayReturnUri: callbackUri,
});

// Open started.authorizationUrl in a system authentication browser.

const callback = await omsWallet.wallet.handleOidcRedirectCallback({
  callbackUrl,
});

if (callback.type === 'completed') {
  console.log(callback.result.walletAddress);
}
```

Use `CustomOidcProviderConfig` when your project owns the OIDC provider configuration and redirect URI.

## Use The Wallet

```ts
import {
  FeeOptionSelectors,
  Networks,
  parseUnits,
} from '@0xsequence/oms-react-native-sdk';

const signature = await omsWallet.wallet.signMessage({
  network: Networks.polygon,
  message: 'Hello from React Native',
});

const transaction = await omsWallet.wallet.sendTransaction({
  network: Networks.polygon,
  to: '0xRecipient',
  value: parseUnits('0.01', 18),
  selectFeeOption: FeeOptionSelectors.firstAvailable,
});
```

`sendTransaction` and `callContract` wait for transaction status by default. Set `waitForStatus: false` to return after submission.

## Query The Indexer

```ts
const walletAddress = await omsWallet.wallet.getWalletAddress();

const balances = await omsWallet.indexer.getBalances({
  walletAddress: walletAddress!,
  networks: [Networks.polygon],
  includeMetadata: true,
});
```

`getBalances` returns native-token balances in `nativeBalances` and token-contract balances in `balances`.

## Native Requirements

- Android: `minSdk 24`, `compileSdk 34` or newer, Java 17, and Android 10 / API 29 or newer at runtime.
- iOS: deployment target 15.0 or newer.
- Redirect authentication: configure the consuming app's callback URI scheme or universal/app link.

The wrapper resolves `io.github.0xsequence:oms-wallet-kotlin-sdk:0.2.0` on Android and `oms-wallet-swift-sdk` `0.2.0` on iOS.

## Reference

See [API.md](./API.md) for the public TypeScript API and [PUBLISHING.md](./PUBLISHING.md) for the release process.

## Examples

- `examples/sdk-example`: bare React Native wallet demo.
- `examples/trails-actions-example`: bare React Native Trails actions demo.
- `examples/expo-example`: standalone Expo development-build demo.

## License

MIT
