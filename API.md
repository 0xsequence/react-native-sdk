# Public API

This document describes the public TypeScript API for external consumers of
`@0xsequence/oms-react-native-sdk`.

## Installation

```sh
npm install @0xsequence/oms-react-native-sdk
```

Android resolves `io.github.0xsequence:oms-client-kotlin-sdk:0.1.0-alpha.1`.
iOS resolves `oms-client-swift-sdk` `0.1.0-alpha.1`.

## Configure

```ts
configure({
  publishableKey: string;
  projectId: string;
  environment?: {
    walletApiUrl?: string;
    apiRpcUrl?: string;
    indexerUrlTemplate?: string;
  };
}): Promise<void>
```

Call `configure` before using wallet, signing, transaction, balance, or access
APIs. `publishableKey` is sent to the native SDKs as the OMS publishable key, and
`projectId` is used for wallet request signing scope and session storage scope.

## Session

```ts
getWalletAddress(): Promise<string | null>
getSession(): Promise<OmsClientSessionState>
signOut(): Promise<void>
```

```ts
type OmsClientSessionState = {
  walletAddress: string | null;
  expiresAt: string | null;
  loginType: 'Email' | 'GoogleAuth' | 'Oidc' | null;
  sessionEmail: string | null;
};
```

`getSession` reports completed wallet-session metadata only. Pending OTP,
redirect verifier state, and signer details are native SDK internals.

## Email Auth

```ts
startEmailAuth(email: string): Promise<void>

completeEmailAuth({
  code: string;
  walletSelection?: 'automatic' | 'manual';
  walletType?: 'ethereum';
}): Promise<OmsCompleteAuthResult>
```

## OIDC ID Token Auth

```ts
signInWithOidcIdToken({
  idToken: string;
  issuer: string;
  audience: string;
  walletSelection?: 'automatic' | 'manual';
  walletType?: 'ethereum';
}): Promise<OmsCompleteAuthResult>
```

Use `walletSelection: 'manual'` when the app should present its own wallet
picker before selecting or creating a wallet.

## OIDC Redirect Auth

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
startOidcRedirectAuth({
  provider: OidcProviderConfig;
  redirectUri: string;
  walletType?: 'ethereum';
  relayRedirectUri?: string | null;
  authorizeParams?: Record<string, string> | null;
}): Promise<{
  authorizationUrl: string;
  state: string;
  challenge: string;
}>

handleOidcRedirectCallback({
  callbackUrl?: string | null;
  walletSelection?: 'automatic' | 'manual';
}): Promise<OmsOidcRedirectAuthResult>
```

Apps own browser opening and deep-link handling. Open `authorizationUrl` with
system auth browser UI such as Custom Tabs or ASWebAuthenticationSession, then
pass the resulting app-link URL to `handleOidcRedirectCallback`.

When `relayRedirectUri` is omitted, the provider default is used. Pass
`relayRedirectUri: null` to explicitly use the app `redirectUri` directly.

## Auth Results

```ts
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
```

```ts
type OmsOidcRedirectAuthResult =
  | { type: 'completed'; wallet: OmsWallet }
  | { type: 'walletSelection'; pendingSelection: OmsPendingWalletSelection }
  | { type: 'notOidcRedirectCallback' }
  | { type: 'noPendingAuth' }
  | { type: 'failed'; message: string };
```

```ts
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

In automatic mode, successful auth selects the first existing wallet matching
`walletType`, or creates and selects one when none exists. In manual mode, no
wallet is selected or created until the app calls a pending-selection method.

## Wallets

```ts
listWallets(): Promise<OmsWallet[]>
useWallet(walletId: string): Promise<OmsWalletActivationResult>
createWallet({
  walletType?: 'ethereum';
  reference?: string | null;
}): Promise<OmsWalletActivationResult>
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

## Networks

```ts
getSupportedNetworks(): Promise<OmsNetwork[]>
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

## Signing

```ts
signMessage(chainId: string, message: string): Promise<string>

signTypedData({
  chainId: string;
  typedData: unknown;
}): Promise<string>

verifyMessageSignature({
  chainId: string;
  message: string;
  signature: string;
}): Promise<boolean>

verifyTypedDataSignature({
  chainId: string;
  typedData: unknown;
  signature: string;
}): Promise<boolean>
```

Signature verification checks against the active wallet session.

## Transactions

```ts
sendTransaction({
  chainId: string;
  to: string;
  value: string;
  data?: string | null;
  mode?: 'native' | 'relayer';
  selectFeeOption?: OmsFeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: OmsTransactionStatusPollingOptions;
}): Promise<OmsSendTransactionResponse>

callContract({
  chainId: string;
  contractAddress: string;
  method: string;
  args?: { type: string; value: unknown }[] | null;
  mode?: 'native' | 'relayer';
  selectFeeOption?: OmsFeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: OmsTransactionStatusPollingOptions;
}): Promise<OmsSendTransactionResponse>

getTransactionStatus(txnId: string): Promise<OmsTransactionStatus>
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

By default, transaction methods poll WaaS after execute until status resolves
or the default timeout is reached. Pass `waitForStatus: false` to return
immediately after execute, or pass `statusPolling` to tune the post-execute
polling timeout, normal interval, fast interval, and fast-poll count.

## Fee Selection

```ts
type OmsFeeOptionSelector = (
  feeOptions: OmsFeeOptionWithBalance[]
) => OmsFeeOptionSelection | null | Promise<OmsFeeOptionSelection | null>;

type OmsFeeOptionSelection = {
  token: string;
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

Return `option.selection` when choosing a quoted fee option. It uses `tokenId`
when present and falls back to the token symbol for native fee options.
Returning `null` is only valid for sponsored transactions.

## Balances

```ts
getTokenBalances({
  chainId: string;
  contractAddress?: string;
  walletAddress: string;
  includeMetadata?: boolean;
  page?: {
    page?: number;
    pageSize?: number;
  };
}): Promise<OmsTokenBalancesResult>

getNativeTokenBalance({
  chainId: string;
  walletAddress: string;
}): Promise<OmsTokenBalance | null>
```

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
};

type OmsTokenBalancesPage = {
  page: number;
  pageSize: number;
  more: boolean;
};
```

Omit `contractAddress` to query balances across token contracts. Pass `page`
to request a later page or a custom page size. When `page` is undefined, the
request defaults to page `0` with up to `40` entries.

## Wallet ID Token

```ts
getIdToken({
  ttlSeconds?: number | null;
  customClaims?: Record<string, unknown> | null;
}): Promise<string>
```

## Wallet Access

```ts
listAccess({ pageSize?: number | null } = {}): Promise<OmsCredentialInfo[]>

listAccessPages(
  { pageSize?: number | null } = {}
): AsyncGenerator<OmsListAccessResponse, void, void>

listAccessPage({
  pageSize?: number | null;
  cursor?: string | null;
} = {}): Promise<OmsListAccessResponse>

revokeAccess(targetCredentialId: string): Promise<void>
```

```ts
type OmsCredentialInfo = {
  credentialId: string;
  expiresAt: string;
  isCaller: boolean;
};

type OmsListAccessResponse = {
  credentials: OmsCredentialInfo[];
  page: {
    limit: number | null;
    cursor: string | null;
  } | null;
};
```

## Unit Helpers

```ts
parseUnits(
  value: string,
  decimals?: number,
  options?: { roundingMode?: 'reject' | 'nearest' }
): string

formatUnits(value: string | bigint, decimals?: number): string
```

`parseUnits` defaults to `roundingMode: 'reject'`, matching Swift and common
JavaScript parseUnits behavior. Use `roundingMode: 'nearest'` to match the
Kotlin SDK helper, which rounds fractional precision beyond `decimals` to the
nearest base unit.
