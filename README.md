# @0xsequence/react-native-sdk

Sequence v3 React Native SDK for seamless web3 integration.

## Installation

To get started, install the `@0xsequence/react-native-sdk` and its peer dependencies.

```sh
yarn add @0xsequence/react-native-sdk @0xsequence/dapp-client @0xsequence/wallet-core @0xsequence/wallet-primitives ox viem
yarn add expo-crypto expo-linking expo-secure-store expo-standard-web-crypto expo-web-browser react-native-mmkv react-native-nitro-modules react-native-url-polyfill
```

or

```sh
npm install @0xsequence/react-native-sdk @0xsequence/dapp-client @0xsequence/wallet-core @0xsequence/wallet-primitives ox viem
npm install expo-crypto expo-linking expo-secure-store expo-standard-web-crypto expo-web-browser react-native-mmkv react-native-nitro-modules react-native-url-polyfill
```

## Usage

First, you need to wrap your application with the `SequenceProvider`. This provider manages the connection state and makes the Sequence context available to all child components.

### 1. Configure the `SequenceProvider`

In your main application file (e.g., `App.tsx`), import and wrap your components with `SequenceProvider`.

```tsx
// App.tsx
import {
  SequenceProvider,
  type SequenceProviderConfig,
} from '@0xsequence/react-native-sdk';
import { arbitrumSepolia } from 'viem/chains';

// Configuration for the Sequence Provider
const config: SequenceProviderConfig = {
  walletUrl: 'https://v3.sequence-dev.app',
  // IMPORTANT: This must match the "scheme" in your app.json
  origin: 'rndemosequencev3://',
  projectAccessKey: 'YOUR_PROJECT_ACCESS_KEY', // Replace with your key
  defaultChainId: arbitrumSepolia.id,
};

export default function App() {
  return (
    <SequenceProvider config={config}>
      {/* Your application components */}
      <YourAppComponent />
    </SequenceProvider>
  );
}
```

**Note:** The `origin` in your config **must** match the `scheme` defined in your `app.json` to handle redirects correctly after a wallet action.

### 2. Use the `useSequence` Hook

The `useSequence` hook provides access to the wallet state and methods to interact with the user's wallet.

Here's a basic example of a component that handles connection and displays wallet information. You can optionally request permissions during the connection process to enable seamless transactions later.

```tsx
// YourAppComponent.tsx
import { useSequence, Signers, Utils } from '@0xsequence/react-native-sdk';
import { View, Text, Button, ActivityIndicator, Alert } from 'react-native';
import { AbiFunction } from 'ox';
import { arbitrumSepolia } from 'viem/chains';

// Define the contract and function you want permission for
const nftContractAddress = '0xD25b37E2fB07f85E9ecA9d40FE3BcF60BA2dc57b';
const mint = AbiFunction.from(['function safeMint(address to)']);

// Construct the permissions object
const getPermissionsForNFTMint = (chainId: number) => {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24); // 24 hours from now

  return {
    chainId: chainId,
    valueLimit: 0n,
    deadline,
    permissions: [
      Utils.PermissionBuilder.for(nftContractAddress).forFunction(mint).build(),
    ],
  };
};

export default function YourAppComponent() {
  const {
    isInitializing,
    isInitialized,
    walletAddress,
    chainId,
    connect,
    disconnect,
  } = useSequence();

  const handleConnect = async () => {
    try {
      await connect({
        loginMethod: 'google',
        // Request permission to mint an NFT when connecting
        explicitSession: getPermissionsForNFTMint(chainId),
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to connect');
    }
  };

  if (isInitializing) {
    return <ActivityIndicator />;
  }

  return (
    <View>
      {!isInitialized ? (
        <Button
          title="Connect with Google and Get Mint Permission"
          onPress={handleConnect}
        />
      ) : (
        <View>
          <Text>Wallet Address: {walletAddress}</Text>
          <Button title="Disconnect" onPress={() => disconnect()} />
        </View>
      )}
    </View>
  );
}
```

## API Reference

### `useSequence()`

This hook returns the `SequenceContextState` object, which contains all the necessary state and methods for interacting with the SDK.

#### Connection State

- `isInitializing: boolean`: True while the SDK is establishing its initial state.
- `isInitialized: boolean`: True once the SDK is initialized and a session is restored or ready to be created.

#### Session Properties

- `walletAddress: string | null`: The address of the connected wallet.
- `sessions: Session[]`: An array of all active sessions for the current user.
- `loginMethod: string | null`: The method used for logging in (e.g., 'google', 'passkey').
- `userEmail: string | null`: The user's email if available.

#### Chain State

- `chainId: number`: The currently selected chain ID.
- `setChainId: (chainId: number) => void`: A function to update the active chain ID.

#### Core Functions

- `connect(options)`: Initiates the connection process.
  - `options.loginMethod`: The preferred login method ('google', 'email', 'passkey').
  - `options.explicitSession`: Request a specific explicit session upon connection. This allows for seamless transactions later without further user prompts.

- `disconnect()`: Clears the current session and disconnects the user.

- `signMessage(message)`: Prompts the user to sign a standard string message. Returns a promise that resolves with the signature.

- `signTypedData(typedData)`: Prompts the user to sign an EIP-712 typed data structure.

- `sendTransaction(transactions)`: Initiates one or more transactions. The return value depends on whether the session has permissions for the transaction.
  - **If permissioned:** It may return `feeOptions` if the relayer requires a fee. The developer can then choose a fee and call the returned `send` function. If no fee is required, it sends the transaction directly.
  - **If not permissioned:** It redirects the user to the wallet for approval.
  - **Returns:** `Promise<SendTransactionResult>`

    ```typescript
    // If no fee is required or if sent via wallet
    { isFeeRequired: false, txHash: HexString }

    // If a fee is required for a permissioned session
    {
      isFeeRequired: true,
      feeOptions: Relayer.FeeOption[],
      send: (feeOption) => Promise<HexString>
    }
    ```

- `addExplicitSession(explicitSessionConfig)`: Prompts the user to approve a new session with a specific set of permissions (e.g., for minting an NFT without being prompted every time).

- `hasPermission(transactions)`: Checks if the current session has sufficient permissions to execute the given transactions without requiring wallet approval. Returns `Promise<boolean>`.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## Troubleshooting

### Build Errors (`ERR_REQUIRE_ESM`)

If you encounter an error similar to `Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported` while running the build script (`yarn prepare`), it is likely due to an incompatible Node.js version.

**Solution:** The build tooling for this project requires a modern version of Node.js that supports ES Modules in CommonJS files. Please ensure you are using **Node.js v22.15.1 or higher**.

It is highly recommended to use a version manager like [nvm](https://github.com/nvm-sh/nvm) to easily switch between Node.js versions. You can install and switch to the required version by running:

```sh
nvm install 22.15.1
nvm use 22.15.1
```

## License

MIT
