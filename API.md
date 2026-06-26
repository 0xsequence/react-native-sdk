# Public API

This document describes the public TypeScript API for
`@0xsequence/oms-react-native-sdk`.

## Installation

```sh
npm install @0xsequence/oms-react-native-sdk
```

## Client

```ts
import { OMSClient } from '@0xsequence/oms-react-native-sdk';

const oms = new OMSClient({
  publishableKey: '<publishable-key>',
});
```

```ts
new OMSClient(config: OmsClientConfig)

type OmsClientConfig = {
  publishableKey: string;
};
```

`OMSClient` exposes `wallet`, `indexer`, and `supportedNetworks`.

## Wallet

All wallet APIs are accessed through `oms.wallet`.

### Session

```ts
oms.wallet.getWalletAddress(): Promise<string | null>
oms.wallet.getSession(): Promise<OmsClientSessionState>
oms.wallet.onSessionExpired(
  listener: (event: OmsClientSessionExpiredEvent) => void
): { remove(): void }
oms.wallet.signOut(): Promise<void>
```

```ts
type OmsClientSessionState = {
  walletAddress: string | null;
  expiresAt: string | null;
  loginType: 'Email' | 'GoogleAuth' | 'Oidc' | null;
  sessionEmail: string | null;
};

type OmsClientSessionExpiredEvent = {
  session: OmsClientSessionState;
  expiredAt: string;
};
```

### Email Auth

```ts
oms.wallet.startEmailAuth(email: string): Promise<void>

oms.wallet.completeEmailAuth({
  code: string;
  walletSelection?: 'automatic' | 'manual';
  walletType?: 'ethereum';
  sessionLifetimeSeconds?: number | null;
}): Promise<OmsCompleteAuthResult>
```

### OIDC ID Token Auth

```ts
oms.wallet.signInWithOidcIdToken({
  idToken: string;
  issuer: string;
  audience: string;
  walletSelection?: 'automatic' | 'manual';
  walletType?: 'ethereum';
  sessionLifetimeSeconds?: number | null;
}): Promise<OmsCompleteAuthResult>
```

### OIDC Redirect Auth

```ts
type OidcProviderConfig = {
  issuer: string;
  clientId: string;
  authorizationUrl: string;
  scopes?: string[];
  relayRedirectUri?: string | null;
  authorizeParams?: Record<string, string>;
};

OidcProviders.google(params?: {
  clientId?: string;
  relayRedirectUri?: string | null;
  scopes?: string[];
  authorizeParams?: Record<string, string>;
}): OidcProviderConfig
```

```ts
oms.wallet.startOidcRedirectAuth({
  provider: OidcProviderConfig;
  redirectUri: string;
  walletType?: 'ethereum';
  relayRedirectUri?: string | null;
  authorizeParams?: Record<string, string> | null;
  loginHint?: string | null;
}): Promise<OmsStartOidcRedirectAuthResult>

type OmsStartOidcRedirectAuthResult = {
  authorizationUrl: string;
  state: string;
  challenge: string;
};

oms.wallet.handleOidcRedirectCallback({
  callbackUrl?: string | null;
  walletSelection?: 'automatic' | 'manual';
  sessionLifetimeSeconds?: number | null;
}): Promise<OmsOidcRedirectAuthResult>
```

Apps own browser opening and deep-link handling. Open `authorizationUrl` with a
system auth browser, then pass the resulting app-link URL to
`handleOidcRedirectCallback`.

### Auth Results

```ts
type OmsCredentialInfo = {
  credentialId: string;
  expiresAt: string;
  isCaller: boolean;
};

type OmsCompleteAuthResult =
  | {
      type: 'walletSelected';
      walletAddress: string;
      wallet: OmsWallet;
      wallets: OmsWallet[];
      credential: OmsCredentialInfo;
    }
  | {
      type: 'walletSelection';
      walletAddress: null;
      wallet: null;
      wallets: OmsWallet[];
      credential: OmsCredentialInfo;
      pendingSelection: OmsPendingWalletSelection;
    };

type OmsOidcRedirectAuthResult =
  | { type: 'completed'; wallet: OmsWallet }
  | { type: 'walletSelection'; pendingSelection: OmsPendingWalletSelection }
  | { type: 'notOidcRedirectCallback' }
  | { type: 'noPendingAuth' }
  | { type: 'failed'; message: string };

type OmsPendingWalletSelection = {
  id: string;
  walletType: 'ethereum';
  wallets: OmsWallet[];
  credential: OmsCredentialInfo;
  selectWallet(walletId: string): Promise<OmsWalletActivationResult>;
  createAndSelectWallet(
    reference?: string | null
  ): Promise<OmsWalletActivationResult>;
};
```

### Wallets

```ts
oms.wallet.listWallets(): Promise<OmsWallet[]>
oms.wallet.useWallet(walletId: string): Promise<OmsWalletActivationResult>
oms.wallet.createWallet({
  walletType?: 'ethereum';
  reference?: string | null;
} = {}): Promise<OmsWalletActivationResult>
```

```ts
type OmsWallet = {
  id: string;
  type: string;
  address: string;
  reference: string | null;
};

type OmsWalletActivationResult = {
  walletAddress: string;
  wallet: OmsWallet;
};
```

### Signing

```ts
oms.wallet.signMessage(chainId: string, message: string): Promise<string>

oms.wallet.signTypedData({
  chainId: string;
  typedData: unknown;
}): Promise<string>

oms.wallet.verifyMessageSignature({
  chainId: string;
  message: string;
  signature: string;
}): Promise<boolean>

oms.wallet.verifyTypedDataSignature({
  chainId: string;
  typedData: unknown;
  signature: string;
}): Promise<boolean>
```

Signature verification checks against the active wallet session.

### Transactions

```ts
oms.wallet.sendTransaction({
  chainId: string;
  to: string;
  value: string;
  data?: string | null;
  mode?: 'native' | 'relayer';
  selectFeeOption?: OmsFeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: OmsTransactionStatusPollingOptions;
}): Promise<OmsSendTransactionResponse>

oms.wallet.callContract({
  chainId: string;
  contractAddress: string;
  method: string;
  args?: { type: string; value: unknown }[] | null;
  mode?: 'native' | 'relayer';
  selectFeeOption?: OmsFeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: OmsTransactionStatusPollingOptions;
}): Promise<OmsSendTransactionResponse>

oms.wallet.getTransactionStatus(txnId: string): Promise<OmsTransactionStatus>
```

```ts
type OmsSendTransactionResponse = {
  txnId: string;
  status: string;
  txnHash: string | null;
};

type OmsTransactionStatus = {
  status: string;
  txnHash: string | null;
};

type OmsTransactionStatusPollingOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  fastIntervalMs?: number;
  fastPollCount?: number;
};
```

`value` is a raw base-unit integer string. Use `parseUnits` for display-value
conversion before sending.

### Fee Selection

```ts
type OmsFeeOptionSelector = (
  feeOptions: OmsFeeOptionWithBalance[]
) => OmsFeeOptionSelection | null | Promise<OmsFeeOptionSelection | null>;

type OmsFeeOptionSelection = {
  token: string;
};

type OmsFeeToken = {
  network: string;
  name: string;
  symbol: string;
  type: string;
  decimals: number | null;
  logoUrl: string | null;
  contractAddress: string | null;
  tokenId: string | null;
};

type OmsFeeOption = {
  token: OmsFeeToken;
  value: string;
  displayValue: string;
};

type OmsFeeOptionWithBalance = {
  feeOption: OmsFeeOption;
  selection: OmsFeeOptionSelection;
  balance: OmsTokenBalance | null;
  available: string | null;
  availableRaw: string | null;
  decimals: number | null;
};
```

Return `option.selection` when choosing a quoted fee option.

### ID Token And Access

```ts
oms.wallet.getIdToken({
  ttlSeconds?: number | null;
  customClaims?: Record<string, unknown> | null;
} = {}): Promise<string>

oms.wallet.listAccess({ pageSize?: number | null } = {}): Promise<OmsCredentialInfo[]>

oms.wallet.listAccessPages(
  { pageSize?: number | null } = {}
): AsyncGenerator<OmsListAccessResponse, void, void>

oms.wallet.listAccessPage({
  pageSize?: number | null;
  cursor?: string | null;
} = {}): Promise<OmsListAccessResponse>

oms.wallet.revokeAccess(targetCredentialId: string): Promise<void>
```

```ts
type OmsAccessPage = {
  limit: number | null;
  cursor: string | null;
};

type OmsListAccessResponse = {
  credentials: OmsCredentialInfo[];
  page: OmsAccessPage | null;
};
```

## Indexer

All indexer APIs are accessed through `oms.indexer`.

```ts
oms.indexer.getBalances({
  walletAddress: string;
  networks?: OmsNetwork[];
  networkType?: 'MAINNETS' | 'TESTNETS' | 'ALL';
  contractAddresses?: string[];
  includeMetadata?: boolean;
  omitPrices?: boolean | null;
  tokenIds?: string[];
  contractStatus?: 'VERIFIED' | 'UNVERIFIED' | 'ALL' | null;
  page?: {
    page?: number;
    pageSize?: number;
  };
}): Promise<OmsBalancesResult>

oms.indexer.getTransactionHistory({
  walletAddress: string;
  networks?: OmsNetwork[];
  networkType?: 'MAINNETS' | 'TESTNETS' | 'ALL';
  contractAddresses?: string[];
  transactionHashes?: string[];
  metaTransactionIds?: string[];
  fromBlock?: number | null;
  toBlock?: number | null;
  tokenId?: string | null;
  includeMetadata?: boolean;
  omitPrices?: boolean | null;
  metadataOptions?: {
    verifiedOnly?: boolean;
    unverifiedOnly?: boolean;
    includeContracts?: string[];
  } | null;
  page?: {
    page?: number;
    pageSize?: number;
  };
}): Promise<OmsTransactionHistoryResult>
```

```ts
type OmsBalancesResult = {
  status: number;
  page?: OmsTokenBalancesPage | null;
  nativeBalances: OmsTokenBalance[];
  balances: OmsTokenBalance[];
};

type OmsTransactionHistoryResult = {
  status: number;
  page?: OmsTokenBalancesPage | null;
  transactions: OmsTransaction[];
};

type OmsTransaction = {
  txnHash: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  chainId: number | null;
  metaTxnId?: string | null;
  transfers?: OmsTransactionTransfer[] | null;
  timestamp?: string | null;
};

type OmsTransactionTransfer = {
  transferType?: string | null;
  contractAddress?: string | null;
  contractType?: string | null;
  from?: string | null;
  to?: string | null;
  tokenIds?: string[] | null;
  amounts?: string[] | null;
  logIndex?: number | null;
  amountsUSD?: string[] | null;
  pricesUSD?: string[] | null;
  contractInfo?: OmsTokenContractInfo | null;
  tokenMetadata?: unknown | null;
};
```

Pass `networks` for explicit chain selection. If omitted, `networkType`
defaults to `MAINNETS`.

## Networks

```ts
oms.supportedNetworks: OmsNetwork[]
```

```ts
type OmsNetwork = {
  chainId: string;
  name: string;
  nativeTokenSymbol: string;
  explorerUrl: string;
  displayName: string;
};
```

Wallet, transaction, signature, and indexer APIs take `chainId` as a string.

## Token Types

```ts
type OmsTokenBalance = {
  contractType: string | null;
  contractAddress: string | null;
  accountAddress: string | null;
  tokenId: string | null;
  balance: string | null;
  blockHash: string | null;
  blockNumber?: number | null;
  chainId?: number | null;
  name?: string | null;
  symbol?: string | null;
  balanceUSD?: string | null;
  priceUSD?: string | null;
  priceUpdatedAt?: string | null;
  uniqueCollectibles?: string | null;
  isSummary?: boolean | null;
  contractInfo?: OmsTokenContractInfo | null;
  tokenMetadata?: OmsTokenMetadata | null;
};

type OmsTokenBalancesPage = {
  page: number | null;
  pageSize: number | null;
  more: boolean | null;
};
```

The SDK also exports `OmsTokenContractInfo`, `OmsTokenMetadata`, and
`OmsTokenMetadataAsset` for metadata returned in these fields.

## Formatting Helpers

```ts
parseUnits(value: string, decimals?: number, options?: ParseUnitsOptions): string
formatUnits(value: string | bigint, decimals?: number): string

type ParseUnitsRoundingMode = 'reject' | 'nearest';

type ParseUnitsOptions = {
  roundingMode?: ParseUnitsRoundingMode;
};
```

By default `parseUnits` rounds fractional precision beyond `decimals` to the
nearest base unit. Pass `{ roundingMode: 'reject' }` to fail on non-zero excess
precision.
