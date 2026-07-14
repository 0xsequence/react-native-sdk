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
omsWallet.wallet.startEmailAuth({
  email: string;
  sessionLifetimeSeconds?: number | null;
}): Promise<void>

omsWallet.wallet.completeEmailAuth({
  code: string;
  walletSelection?: 'automatic' | 'manual';
  walletType?: 'ethereum';
}): Promise<CompleteAuthResult>
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
}): Promise<CompleteAuthResult>
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
  callbackUrl: string;
  walletSelection?: 'automatic' | 'manual';
  sessionLifetimeSeconds?: number | null;
}): Promise<OidcRedirectAuthResult>

type OidcRedirectAuthResult =
  | { type: 'completed'; result: CompleteAuthResult }
  | { type: 'notOidcRedirectCallback' }
  | { type: 'noPendingAuth' };
```

### Auth Results

```ts
type CompleteAuthResult =
  | {
      type: 'walletSelected';
      walletAddress: string;
      wallet: WalletAccount;
      wallets: WalletAccount[];
      credential: CredentialInfo;
    }
  | {
      type: 'walletSelection';
      walletAddress: null;
      wallet: null;
      wallets: WalletAccount[];
      credential: CredentialInfo;
      pendingSelection: PendingWalletSelection;
    };

type PendingWalletSelection = {
  walletType: 'ethereum';
  wallets: WalletAccount[];
  credential: CredentialInfo;
  selectWallet(walletId: string): Promise<WalletActivationResult>;
  createAndSelectWallet(
    reference?: string | null
  ): Promise<WalletActivationResult>;
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
  type: 'ethereum';
  address: string;
  reference: string | null;
};

omsWallet.wallet.listWallets(): Promise<WalletAccount[]>
omsWallet.wallet.useWallet(walletId: string): Promise<WalletActivationResult>
omsWallet.wallet.createWallet({
  walletType?: 'ethereum';
  reference?: string | null;
} = {}): Promise<WalletActivationResult>
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
  selectFeeOption?: FeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: TransactionStatusPollingOptions;
}): Promise<SendTransactionResponse>

omsWallet.wallet.callContract({
  network: Network;
  contractAddress: string;
  method: string;
  args?: { type: string; value: unknown }[] | null;
  mode?: 'native' | 'relayer';
  selectFeeOption?: FeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: TransactionStatusPollingOptions;
}): Promise<SendTransactionResponse>

omsWallet.wallet.getTransactionStatus(
  txnId: string
): Promise<TransactionStatusResponse>
```

`waitForStatus` defaults to `true`. `value` is a raw base-unit integer string.

```ts
type SendTransactionResponse = {
  txnId: string;
  status: TransactionStatus;
  txnHash: string | null;
  statusResolution: 'not-requested' | 'resolved' | 'timed-out';
};

type TransactionStatus =
  | 'quoted'
  | 'pending'
  | 'executed'
  | 'failed'
  | 'unknown';

type TransactionStatusResponse = {
  status: TransactionStatus;
  txnHash: string | null;
};

type TransactionStatusPollingOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  fastIntervalMs?: number;
  fastPollCount?: number;
};
```

### Fee Selection

```ts
type FeeOptionSelector = (
  feeOptions: FeeOptionWithBalance[]
) => FeeOptionSelection | null | Promise<FeeOptionSelection | null>;

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
} = {}): Promise<CredentialInfo[]>

omsWallet.wallet.listAccessPages({
  pageSize?: number | null;
} = {}): AsyncGenerator<ListAccessResponse, void, void>

omsWallet.wallet.listAccessPage({
  pageSize?: number | null;
  cursor?: string | null;
} = {}): Promise<ListAccessResponse>

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
}): Promise<BalancesResult>

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
  metadataOptions?: MetadataOptions | null;
  page?: { page?: number; pageSize?: number };
}): Promise<TransactionHistoryResult>
```

## Returned Models

```ts
type WalletActivationResult = {
  walletAddress: string;
  wallet: WalletAccount;
};

type CredentialInfo = {
  credentialId: string;
  expiresAt: string;
  isCaller: boolean;
};

type AccessPage = {
  limit: number | null;
  cursor: string | null;
};

type ListAccessResponse = {
  credentials: CredentialInfo[];
  page: AccessPage | null;
};
```

Fee quotes use the following models:

```ts
type FeeToken = {
  network: string;
  name: string;
  symbol: string;
  type: string;
  decimals: number | null;
  logoUrl: string | null;
  contractAddress: string | null;
  tokenId: string | null;
};

type FeeOption = {
  token: FeeToken;
  value: string;
  displayValue: string;
};

type FeeOptionSelection = { token: string };

type FeeOptionWithBalance = {
  feeOption: FeeOption;
  selection: FeeOptionSelection;
  balance: TokenBalance | null;
  available: string | null;
  availableRaw: string | null;
  decimals: number | null;
};
```

Indexer responses use the following models:

```ts
type TokenBalancesPage = {
  page: number | null;
  pageSize: number | null;
  more: boolean | null;
};

type TokenBalance = {
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
  contractInfo?: TokenContractInfo | null;
  tokenMetadata?: TokenMetadata | null;
};

type TokenContractInfo = {
  chainId?: number | null;
  address?: string | null;
  source?: string | null;
  name?: string | null;
  type?: string | null;
  symbol?: string | null;
  decimals?: number | null;
  logoURI?: string | null;
  deployed?: boolean | null;
  bytecodeHash?: string | null;
  extensions?: Record<string, unknown> | null;
  updatedAt?: string | null;
  queuedAt?: string | null;
  status?: string | null;
};

type TokenMetadataAsset = {
  id?: number | null;
  collectionId?: number | null;
  tokenId?: string | null;
  url?: string | null;
  metadataField?: string | null;
  name?: string | null;
  filesize?: number | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  updatedAt?: string | null;
};

type TokenMetadata = {
  chainId?: number | null;
  contractAddress?: string | null;
  tokenId?: string | null;
  source?: string | null;
  name?: string | null;
  description?: string | null;
  image?: string | null;
  video?: string | null;
  audio?: string | null;
  properties?: Record<string, unknown> | null;
  attributes?: Record<string, unknown>[] | null;
  imageData?: string | null;
  externalUrl?: string | null;
  backgroundColor?: string | null;
  animationUrl?: string | null;
  decimals?: number | null;
  updatedAt?: string | null;
  assets?: TokenMetadataAsset[] | null;
  status?: string | null;
  queuedAt?: string | null;
  lastFetched?: string | null;
};

type BalancesResult = {
  status: number;
  page?: TokenBalancesPage | null;
  nativeBalances: TokenBalance[];
  balances: TokenBalance[];
};

type TransactionHistoryResult = {
  status: number;
  page?: TokenBalancesPage | null;
  transactions: Transaction[];
};

type Transaction = {
  txnHash: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  chainId: number | null;
  metaTxnId?: string | null;
  transfers?: TransactionTransfer[] | null;
  timestamp?: string | null;
};

type TransactionTransfer = {
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
  contractInfo?: TokenContractInfo | null;
  tokenMetadata?: Record<string, unknown> | null;
};
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
