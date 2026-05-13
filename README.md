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
  signMessage,
  startEmailAuth,
} from 'oms-client-react-native-sdk';

await configure({
  projectAccessKey: '<project-access-key>',
});

await startEmailAuth('player@example.com');
const wallet = await completeEmailAuth('<otp-code>');

const signature = await signMessage('137', 'Hello from React Native');
const address = await getWalletAddress();
```

## Local native SDKs

Android resolves the local Kotlin SDK from Maven local:

```gradle
implementation "io.github.0xsequence:oms-client-kotlin-sdk:0.0.1-local.2"
```

iOS resolves the local Swift SDK from the example Podfile:

```ruby
pod "OMS-SDK", :path => "../../../swift-sdk"
```

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
