# @polygonlabs/oms-wallet-react-native

OMS Wallet SDK for bare React Native apps and Expo development builds on iOS and Android.

[API reference](https://docs.polygon.technology/wallets/sdk/react-native/api-reference)

## Requirements

- React Native 0.85 or newer with React 19.2 or newer
- Android `minSdk 24`, `compileSdk 36`, Java 17, and Android 10 / API 29 or newer at runtime
- iOS 15 or newer with Xcode 26

The package contains native code. Expo Go and React Native Web are not supported.

## Bare React Native

Install the package:

```sh
npm install @polygonlabs/oms-wallet-react-native
```

React Native autolinking connects the native modules. Install the iOS pods after adding the package:

```sh
npx pod-install
```

## Expo

Install the package in an Expo SDK 56 app:

```sh
npx expo install @polygonlabs/oms-wallet-react-native
```

Create a native development build with prebuild or EAS Build:

```sh
npx expo prebuild
npx expo run:ios
# or: npx expo run:android
```

No SDK config plugin is required. Add your redirect scheme to the app's Expo configuration when using redirect authentication.

## Create The Client

Create one `OMSWallet` and reuse it for the lifetime of the app:

```ts
import { OMSWallet } from '@polygonlabs/oms-wallet-react-native';

const omsWallet = new OMSWallet({
  publishableKey: '<publishable-key>',
});
```

## Authenticate With Email

```ts
await omsWallet.wallet.startEmailAuth({
  email: 'player@example.com',
  sessionLifetimeSeconds: 604800,
});

const { walletAddress } = await omsWallet.wallet.completeEmailAuth({
  code: '<otp-code>',
});

console.log(walletAddress);
```

Automatic wallet selection is the default. Handle `walletSelection` only when an authentication call requests manual selection.

## Authenticate With An OIDC ID Token

For mobile integrations, prefer the provider's native SDK when it can return an ID token:

```ts
await omsWallet.wallet.signInWithOidcIdToken({
  idToken,
  issuer: 'https://accounts.google.com',
  audience: '<google-client-id>',
  provider: 'google',
  providerLabel: 'Google',
});
```

## Authenticate With A Redirect

The app presents the browser and passes the returned callback URI to OMS Wallet. For the fixed OMS Google and Apple configurations, use `OmsRelayOidcProviders`:

```ts
import { OmsRelayOidcProviders } from '@polygonlabs/oms-wallet-react-native';

const callbackUri = 'com.example.app://auth/callback';
const started = await omsWallet.wallet.startOidcRedirectAuth({
  provider: OmsRelayOidcProviders.google,
  omsRelayReturnUri: callbackUri,
});

// Present started.authorizationUrl with the app's authentication browser.

const callback = await omsWallet.wallet.handleOidcRedirectCallback({
  callbackUrl: returnedCallbackUrl,
});
```

Bare React Native apps can use an authentication-browser package such as `react-native-inappbrowser-reborn`. Expo apps can use `expo-web-browser` in a development build. `CustomOidcProviderConfig` is for a provider configuration owned by your project.

## Use The Wallet

```ts
import {
  FeeOptionSelectors,
  Networks,
  parseUnits,
} from '@polygonlabs/oms-wallet-react-native';

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

## Documentation

- [React Native SDK guide](https://docs.polygon.technology/wallets/sdk/react-native/quickstart)
- [Public TypeScript API](./API.md)

## Examples

- `examples/sdk-example`: bare React Native wallet demo
- `examples/trails-actions-example`: bare React Native Trails actions demo
- `examples/expo-example`: Expo development-build wallet demo

## License

Apache-2.0
