# oms-client-react-native-sdk

React Native SDK for the OMS platform.

## Installation

```sh
npm install oms-client-react-native-sdk
```

## Usage

```ts
import {
  completeEmailAuth,
  configure,
  getWalletAddress,
  OidcProviders,
  signMessage,
  startEmailAuth,
} from 'oms-client-react-native-sdk';

await configure({
  projectAccessKey: '<project-access-key>',
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
  provider: OidcProviders.google({ clientId: '<client-id>' }),
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
    return selected ? { token: selected.feeOption.token.symbol } : null;
  },
});
```

`selectFeeOption` receives the same enriched fee options as the native SDKs:
`feeOption`, wallet `balance`, formatted `available`, raw `availableRaw`, and
`decimals`. Returning `null` means no fee option is selected, which is only valid
for sponsored transactions.

### Unit Formatting

```ts
const raw = parseUnits('12.34', 6); // "12340000"
const formatted = formatUnits(raw, 6); // "12.34"
```

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

Example apps should depend on `oms-client-react-native-sdk`, not directly on the
underlying native SDKs.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
