# Public API

Reference for `@0xsequence/oms-react-native-sdk`.

## Client

```ts
import { OMSWallet } from '@0xsequence/oms-react-native-sdk';

const omsWallet = new OMSWallet({
  publishableKey: '<publishable-key>',
});
```

```ts
new OMSWallet(params: OMSWalletParams)

type OMSWalletParams = {
  publishableKey: string;
};
```

`OMSWallet` exposes `wallet` and `indexer` clients.

## Authentication

### Email

```ts
omsWallet.wallet.startEmailAuth(email: string): Promise<void>

omsWallet.wallet.completeEmailAuth({
  code: string;
  walletSelection?: 'automatic' | 'manual';
  walletType?: 'ethereum';
  sessionLifetimeSeconds?: number | null;
}): Promise<OmsCompleteAuthResult>
```

### OIDC ID Token

```ts
omsWallet.wallet.signInWithOidcIdToken({
  idToken: string;
  issuer: string;
  audience: string;
  walletSelection?: 'automatic' | 'manual';
  walletType?: 'ethereum';
  sessionLifetimeSeconds?: number | null;
  provider?: string | null;
  providerLabel?: string | null;
}): Promise<OmsCompleteAuthResult>
```

### OIDC Redirect

Use the fixed OMS relay provider values with an app callback URI:

```ts
OmsRelayOidcProviders.google
OmsRelayOidcProviders.apple

omsWallet.wallet.startOidcRedirectAuth({
  provider: OmsRelayOidcProviders.google;
  omsRelayReturnUri: string;
  walletType?: 'ethereum';
  walletSelection?: 'automatic' | 'manual' | null;
  sessionLifetimeSeconds?: number | null;
  loginHint?: string | null;
}): Promise<{ authorizationUrl: string }>
```

For a project-owned provider, pass its complete configuration. `providerRedirectUri` is the URI registered with that provider. `omsRelayReturnUri` is not accepted for custom providers.

```ts
type CustomOidcProviderConfig = {
  issuer: string;
  clientId: string;
  authorizationUrl: string;
  providerRedirectUri: string;
  provider?: string | null;
  providerLabel?: string | null;
  scopes?: string[];
  authorizeParams?: Record<string, string>;
  authMode?: 'auth-code' | 'auth-code-pkce';
};

omsWallet.wallet.startOidcRedirectAuth({
  provider: CustomOidcProviderConfig;
  authorizeParams?: Record<string, string> | null;
  walletType?: 'ethereum';
  walletSelection?: 'automatic' | 'manual' | null;
  sessionLifetimeSeconds?: number | null;
  loginHint?: string | null;
}): Promise<{ authorizationUrl: string }>
```

Complete a redirect after the app receives the callback URI:

```ts
omsWallet.wallet.handleOidcRedirectCallback({
  callbackUrl?: string | null;
  walletSelection?: 'automatic' | 'manual';
  sessionLifetimeSeconds?: number | null;
} = {}): Promise<OmsOidcRedirectAuthResult>

type OmsOidcRedirectAuthResult =
  | { type: 'completed'; result: OmsCompleteAuthResult }
  | { type: 'notOidcRedirectCallback' }
  | { type: 'noPendingAuth' };
```

### Auth Results

```ts
type OmsCompleteAuthResult =
  | {
      type: 'walletSelected';
      walletAddress: string;
      wallet: WalletAccount;
      wallets: WalletAccount[];
      credential: OmsCredentialInfo;
    }
  | {
      type: 'walletSelection';
      walletAddress: null;
      wallet: null;
      wallets: WalletAccount[];
      credential: OmsCredentialInfo;
      pendingSelection: OmsPendingWalletSelection;
    };

type OmsPendingWalletSelection = {
  walletType: 'ethereum';
  wallets: WalletAccount[];
  credential: OmsCredentialInfo;
  selectWallet(walletId: string): Promise<OmsWalletActivationResult>;
  createAndSelectWallet(
    reference?: string | null
  ): Promise<OmsWalletActivationResult>;
};
```

The native pending-selection identifier is intentionally not public. Use the methods on `pendingSelection`.

## Session

```ts
omsWallet.wallet.getWalletAddress(): Promise<string | null>
omsWallet.wallet.getSession(): Promise<OMSWalletSessionState>
omsWallet.wallet.onSessionExpired(
  listener: (event: OMSWalletSessionExpiredEvent) => void
): { remove(): void }
omsWallet.wallet.signOut(): Promise<void>
```

```ts
type OMSWalletSessionState = {
  walletAddress: string | null;
  expiresAt: string | null;
  auth:
    | { type: 'email'; email: string | null }
    | {
        type: 'oidc';
        flow: 'redirect' | 'id-token';
        issuer: string;
        provider: string | null;
        providerLabel: string | null;
        email: string | null;
      }
    | null;
};

type OMSWalletSessionExpiredEvent = {
  session: OMSWalletSessionState;
  expiredAt: string;
};
```

## Wallet Management

```ts
type WalletAccount = {
  id: string;
  type: string;
  address: string;
  reference: string | null;
};

omsWallet.wallet.listWallets(): Promise<WalletAccount[]>
omsWallet.wallet.useWallet(walletId: string): Promise<OmsWalletActivationResult>
omsWallet.wallet.createWallet({
  walletType?: 'ethereum';
  reference?: string | null;
} = {}): Promise<OmsWalletActivationResult>
```

## Networks

Wallet and indexer methods accept exported `Network` values:

```ts
Networks.mainnet
Networks.sepolia
Networks.polygon
Networks.amoy
Networks.arbitrum
Networks.arbitrumSepolia
Networks.optimism
Networks.optimismSepolia
Networks.base
Networks.baseSepolia
Networks.bsc
Networks.bscTestnet
Networks.arbitrumNova
Networks.avalanche
Networks.avalancheTestnet
Networks.katana

findNetworkById(chainId: number): Network | undefined
findNetworkByName(name: string): Network | undefined
```

```ts
interface Network {
  readonly id: number;
  readonly name: string;
  readonly nativeTokenSymbol: string;
  readonly explorerUrl: string;
  readonly displayName: string;
}
```

The predefined network values and `Networks` registry are frozen. Arbitrary custom networks are not supported.

## Signing

```ts
omsWallet.wallet.signMessage({
  network: Network;
  message: string;
}): Promise<string>

omsWallet.wallet.signTypedData({
  network: Network;
  typedData: unknown;
}): Promise<string>

omsWallet.wallet.isValidMessageSignature({
  network: Network;
  message: string;
  signature: string;
}): Promise<boolean>

omsWallet.wallet.isValidTypedDataSignature({
  network: Network;
  typedData: unknown;
  signature: string;
}): Promise<boolean>
```

## Transactions

```ts
omsWallet.wallet.sendTransaction({
  network: Network;
  to: string;
  value: string;
  data?: string | null;
  mode?: 'native' | 'relayer';
  selectFeeOption?: OmsFeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: OmsTransactionStatusPollingOptions;
}): Promise<OmsSendTransactionResponse>

omsWallet.wallet.callContract({
  network: Network;
  contractAddress: string;
  method: string;
  args?: { type: string; value: unknown }[] | null;
  mode?: 'native' | 'relayer';
  selectFeeOption?: OmsFeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: OmsTransactionStatusPollingOptions;
}): Promise<OmsSendTransactionResponse>

omsWallet.wallet.getTransactionStatus(
  txnId: string
): Promise<OmsTransactionStatus>
```

`waitForStatus` defaults to `true`. `value` is a raw base-unit integer string.

```ts
type OmsSendTransactionResponse = {
  txnId: string;
  status: string;
  txnHash: string | null;
  statusResolution: 'not-requested' | 'resolved' | 'timed-out';
};

type OmsTransactionStatusPollingOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  fastIntervalMs?: number;
  fastPollCount?: number;
};
```

### Fee Selection

```ts
type OmsFeeOptionSelector = (
  feeOptions: OmsFeeOptionWithBalance[]
) => OmsFeeOptionSelection | null | Promise<OmsFeeOptionSelection | null>;

FeeOptionSelectors.firstAvailable
```

`firstAvailable` returns the first quoted option whose raw available balance covers the fee, or `null` when no option is affordable.

## Wallet ID Tokens And Access

```ts
omsWallet.wallet.getIdToken({
  ttlSeconds?: number | null;
  customClaims?: Record<string, unknown> | null;
} = {}): Promise<string>

omsWallet.wallet.listAccess({
  pageSize?: number | null;
} = {}): Promise<OmsCredentialInfo[]>

omsWallet.wallet.listAccessPages({
  pageSize?: number | null;
} = {}): AsyncGenerator<OmsListAccessResponse, void, void>

omsWallet.wallet.listAccessPage({
  pageSize?: number | null;
  cursor?: string | null;
} = {}): Promise<OmsListAccessResponse>

omsWallet.wallet.revokeAccess(targetCredentialId: string): Promise<void>
```

## Indexer

```ts
omsWallet.indexer.getBalances({
  walletAddress: string;
  networks?: Network[];
  networkType?: 'MAINNETS' | 'TESTNETS' | 'ALL';
  contractAddresses?: string[];
  includeMetadata?: boolean;
  omitPrices?: boolean | null;
  tokenIds?: string[];
  contractStatus?: 'VERIFIED' | 'UNVERIFIED' | 'ALL' | null;
  page?: { page?: number; pageSize?: number };
}): Promise<OmsBalancesResult>

omsWallet.indexer.getTransactionHistory({
  walletAddress: string;
  networks?: Network[];
  networkType?: 'MAINNETS' | 'TESTNETS' | 'ALL';
  contractAddresses?: string[];
  transactionHashes?: string[];
  metaTransactionIds?: string[];
  fromBlock?: number | null;
  toBlock?: number | null;
  tokenId?: string | null;
  includeMetadata?: boolean;
  omitPrices?: boolean | null;
  metadataOptions?: OmsMetadataOptions | null;
  page?: { page?: number; pageSize?: number };
}): Promise<OmsTransactionHistoryResult>
```

## Errors

Native OMS errors are exposed as `OMSWalletError`:

```ts
try {
  await omsWallet.wallet.getIdToken();
} catch (error) {
  if (isOMSWalletError(error)) {
    console.log(error.code, error.operation, error.retryable);
  }
}
```

`OMSWalletError` includes `code`, `operation`, `status`, `txnId`, `retryable`, and `upstreamError`. Bridge input validation and non-OMS native failures remain ordinary `Error` values.

## Unit Helpers

```ts
parseUnits(
  value: string,
  decimals?: number,
  options?: { roundingMode?: 'reject' | 'nearest' }
): string

formatUnits(value: string | bigint, decimals?: number): string
```

`parseUnits` rounds excess fractional precision to the nearest base unit by default. Pass `{ roundingMode: 'reject' }` to reject non-zero excess precision.
