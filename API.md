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
  sessionLifetimeSeconds?: number;
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
  sessionLifetimeSeconds?: number;
  provider?: string;
  providerLabel?: string;
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
  walletSelection?: 'automatic' | 'manual';
  sessionLifetimeSeconds?: number;
  loginHint?: string;
}): Promise<{ authorizationUrl: string }>
```

For a project-owned provider, pass its complete configuration. `providerRedirectUri` is the URI registered with that provider. `omsRelayReturnUri` is not accepted for custom providers.

```ts
type CustomOidcProviderConfig = {
  issuer: string;
  clientId: string;
  authorizationUrl: string;
  providerRedirectUri: string;
  provider?: string;
  providerLabel?: string;
  scopes?: string[];
  authorizeParams?: Record<string, string>;
  authMode?: 'auth-code' | 'auth-code-pkce';
};

omsWallet.wallet.startOidcRedirectAuth({
  provider: CustomOidcProviderConfig;
  authorizeParams?: Record<string, string>;
  walletType?: 'ethereum';
  walletSelection?: 'automatic' | 'manual';
  sessionLifetimeSeconds?: number;
  loginHint?: string;
}): Promise<{ authorizationUrl: string }>
```

Complete a redirect after the app receives the callback URI:

```ts
omsWallet.wallet.handleOidcRedirectCallback({
  callbackUrl: string;
  walletSelection?: 'automatic' | 'manual';
  sessionLifetimeSeconds?: number;
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
      walletAddress: undefined;
      wallet: undefined;
      wallets: WalletAccount[];
      credential: CredentialInfo;
      pendingSelection: PendingWalletSelection;
    };

type PendingWalletSelection = {
  walletType: 'ethereum';
  wallets: WalletAccount[];
  credential: CredentialInfo;
  selectWallet(walletId: string): Promise<WalletActivationResult>;
  createAndSelectWallet(reference?: string): Promise<WalletActivationResult>;
};
```

The native pending-selection identifier is intentionally not public. Use the methods on `pendingSelection`.

## Session

```ts
omsWallet.wallet.getWalletAddress(): Promise<string | undefined>
omsWallet.wallet.getSession(): Promise<OMSWalletSessionState>
omsWallet.wallet.onSessionExpired(
  listener: (event: OMSWalletSessionExpiredEvent) => void
): { remove(): void }
omsWallet.wallet.signOut(): Promise<void>
```

```ts
type OMSWalletSessionState = {
  walletAddress: string | undefined;
  expiresAt: string | undefined;
  auth:
    | { type: 'email'; email: string }
    | {
        type: 'oidc';
        flow: 'redirect' | 'id-token';
        issuer: string;
        provider: string | undefined;
        providerLabel: string | undefined;
        email: string | undefined;
      }
    | undefined;
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
  reference?: string;
};

omsWallet.wallet.listWallets(): Promise<WalletAccount[]>
omsWallet.wallet.useWallet(walletId: string): Promise<WalletActivationResult>
omsWallet.wallet.createWallet({
  walletType?: 'ethereum';
  reference?: string;
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
  data?: string;
  mode?: 'native' | 'relayer';
  selectFeeOption?: FeeOptionSelector;
  waitForStatus?: boolean;
  statusPolling?: TransactionStatusPollingOptions;
}): Promise<SendTransactionResponse>

omsWallet.wallet.callContract({
  network: Network;
  contractAddress: string;
  method: string;
  args?: { type: string; value: unknown }[];
  mode?: 'native' | 'relayer';
  selectFeeOption?: FeeOptionSelector;
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
  txnHash?: string;
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
  txnHash?: string;
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
) => FeeOptionSelection | undefined | Promise<FeeOptionSelection | undefined>;

FeeOptionSelectors.firstAvailable
```

`firstAvailable` returns the first quoted option whose raw available balance covers the fee, or `undefined` when no option is affordable.

## Wallet ID Tokens And Access

```ts
omsWallet.wallet.getIdToken({
  ttlSeconds?: number;
  customClaims?: Record<string, unknown>;
} = {}): Promise<string>

omsWallet.wallet.listAccess({
  pageSize?: number;
} = {}): Promise<CredentialInfo[]>

omsWallet.wallet.listAccessPages({
  pageSize?: number;
} = {}): AsyncGenerator<ListAccessResponse, void, void>

omsWallet.wallet.listAccessPage({
  pageSize?: number;
  cursor?: string;
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
  omitPrices?: boolean;
  tokenIds?: string[];
  contractStatus?: 'VERIFIED' | 'UNVERIFIED' | 'ALL';
  page?: { page?: number; pageSize?: number };
}): Promise<BalancesResult>

omsWallet.indexer.getTransactionHistory({
  walletAddress: string;
  networks?: Network[];
  networkType?: 'MAINNETS' | 'TESTNETS' | 'ALL';
  contractAddresses?: string[];
  transactionHashes?: string[];
  metaTransactionIds?: string[];
  fromBlock?: number;
  toBlock?: number;
  tokenId?: string;
  includeMetadata?: boolean;
  omitPrices?: boolean;
  metadataOptions?: MetadataOptions;
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
  limit?: number;
  cursor?: string;
};

type ListAccessResponse = {
  credentials: CredentialInfo[];
  page?: AccessPage;
};
```

Fee quotes use the following models:

```ts
type FeeToken = {
  network: string;
  name: string;
  symbol: string;
  type: string;
  decimals?: number;
  logoUrl?: string;
  contractAddress?: string;
  tokenId?: string;
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
  balance?: TokenBalance;
  available?: string;
  availableRaw?: string;
  decimals?: number;
};
```

Indexer responses use the following models:

```ts
type TokenBalancesPage = {
  page: number;
  pageSize: number;
  more: boolean;
};

type NativeTokenBalance = {
  contractType: 'NATIVE';
  contractAddress?: undefined;
  accountAddress: string;
  tokenId?: undefined;
  name: string;
  symbol: string;
  balance: string;
  chainId: number;
  balanceUSD?: string;
  priceUSD?: string;
  priceUpdatedAt?: string;
};

type ContractTokenBalance = {
  contractType: string;
  contractAddress: string;
  accountAddress: string;
  tokenId: string;
  balance: string;
  blockHash: string;
  blockNumber: number;
  chainId: number;
  balanceUSD?: string;
  priceUSD?: string;
  priceUpdatedAt?: string;
  uniqueCollectibles?: string;
  isSummary?: boolean;
  contractInfo?: TokenContractInfo;
  tokenMetadata?: TokenMetadata;
};

type TokenBalance = NativeTokenBalance | ContractTokenBalance;

type TokenContractInfo = {
  chainId: number;
  address: string;
  source: string;
  name: string;
  type: string;
  symbol: string;
  decimals?: number;
  logoURI?: string;
  deployed: boolean;
  bytecodeHash: string;
  extensions: Record<string, unknown>;
  updatedAt: string;
  queuedAt?: string;
  status: string;
};

type TokenMetadataAsset = {
  id?: number;
  collectionId?: number;
  tokenId?: string;
  url?: string;
  metadataField?: string;
  name?: string;
  filesize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  updatedAt?: string;
};

type TokenMetadata = {
  chainId?: number;
  contractAddress?: string;
  tokenId: string;
  source: string;
  name: string;
  description?: string;
  image?: string;
  video?: string;
  audio?: string;
  properties?: Record<string, unknown>;
  attributes: Record<string, unknown>[];
  imageData?: string;
  externalUrl?: string;
  backgroundColor?: string;
  animationUrl?: string;
  decimals?: number;
  updatedAt?: string;
  assets?: TokenMetadataAsset[];
  status: string;
  queuedAt?: string;
  lastFetched?: string;
};

type BalancesResult = {
  status: number;
  page?: TokenBalancesPage;
  nativeBalances: NativeTokenBalance[];
  balances: ContractTokenBalance[];
};

type TransactionHistoryResult = {
  status: number;
  page?: TokenBalancesPage;
  transactions: Transaction[];
};

type Transaction = {
  txnHash: string;
  blockNumber: number;
  blockHash: string;
  chainId: number;
  metaTxnId?: string;
  transfers: TransactionTransfer[];
  timestamp: string;
};

type TransactionTransfer = {
  transferType: string;
  contractAddress: string;
  contractType: string;
  from: string;
  to: string;
  tokenIds?: string[];
  amounts: string[];
  logIndex: number;
  amountsUSD?: string[];
  pricesUSD?: string[];
  contractInfo?: TokenContractInfo;
  tokenMetadata?: Record<string, TokenMetadata>;
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

```ts
type OMSWalletUpstreamError = {
  service: 'waas' | 'indexer';
  name?: string;
  code?: string;
  message?: string;
  status?: number;
};

class OMSWalletError extends Error {
  readonly code: OMSWalletErrorCode;
  readonly operation?: string;
  readonly status?: number;
  readonly txnId?: string;
  readonly retryable?: boolean;
  readonly upstreamError?: OMSWalletUpstreamError;
}
```

Bridge input validation and non-OMS native failures remain ordinary `Error` values.

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
