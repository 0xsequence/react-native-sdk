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
  sendTransaction,
  signMessage,
  startEmailAuth,
} from 'oms-client-react-native-sdk';

await configure({
  projectAccessKey: '<project-access-key>',
  projectId: '<project-id>',
});

await startEmailAuth('player@example.com');
const wallet = await completeEmailAuth('<otp-code>');

const signature = await signMessage('137', 'Hello from React Native');
const address = await getWalletAddress();
const transaction = await sendTransaction({
  chainId: '137',
  to: '<recipient-address>',
  value: '0',
});
console.log(transaction.txnHash ?? transaction.txnId, transaction.status);
```

## Native SDK Dependencies

The React Native SDK owns its native SDK dependencies. Android resolves
`oms-client-kotlin-sdk` from the SDK Gradle module, and iOS resolves
`oms-client-swift-sdk` from the SDK podspec.

Example apps should depend on `oms-client-react-native-sdk`, not directly on the
underlying native SDKs. For local development, the native SDK artifacts still
need to be available through Maven local and CocoaPods local specs until they are
published.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
