import type { Network } from './networks';

export type WalletType = 'ethereum';

export type WalletSelectionBehavior = 'automatic' | 'manual';

export type OMSWalletEmailSessionAuth = {
  type: 'email';
  email: string | null;
};

export type OMSWalletOidcSessionAuthFlow = 'redirect' | 'id-token';

export type OMSWalletOidcSessionAuth = {
  type: 'oidc';
  flow: OMSWalletOidcSessionAuthFlow;
  issuer: string;
  provider: string | null;
  providerLabel: string | null;
  email: string | null;
};

export type OMSWalletSessionAuth =
  | OMSWalletEmailSessionAuth
  | OMSWalletOidcSessionAuth;

export type OMSWalletSessionState = {
  walletAddress: string | null;
  expiresAt: string | null;
  auth: OMSWalletSessionAuth | null;
};

export type OMSWalletSessionExpiredEvent = {
  session: OMSWalletSessionState;
  expiredAt: string;
};

export type OMSWalletParams = {
  publishableKey: string;
};

export type WalletAccount = {
  id: string;
  type: WalletType;
  address: string;
  reference: string | null;
};

export type WalletActivationResult = {
  walletAddress: string;
  wallet: WalletAccount;
};

export type CredentialInfo = {
  credentialId: string;
  expiresAt: string;
  isCaller: boolean;
};

export type PendingWalletSelection = {
  walletType: WalletType;
  wallets: WalletAccount[];
  credential: CredentialInfo;
  selectWallet(walletId: string): Promise<WalletActivationResult>;
  createAndSelectWallet(
    reference?: string | null
  ): Promise<WalletActivationResult>;
};

export type CompleteAuthResult =
  | {
      type: 'walletSelected';
      walletAddress: string;
      wallet: WalletAccount;
      wallets: WalletAccount[];
      credential: CredentialInfo;
      pendingSelection?: undefined;
    }
  | {
      type: 'walletSelection';
      walletAddress: null;
      wallet: null;
      wallets: WalletAccount[];
      credential: CredentialInfo;
      pendingSelection: PendingWalletSelection;
    };

export type StartOidcRedirectAuthResult = {
  authorizationUrl: string;
};

export type OidcRedirectAuthResult =
  | { type: 'completed'; result: CompleteAuthResult }
  | {
      type: 'notOidcRedirectCallback' | 'noPendingAuth';
      result?: undefined;
    };

export type StartEmailAuthParams = {
  email: string;
  sessionLifetimeSeconds?: number | null;
};

export type CompleteEmailAuthParams = {
  code: string;
  walletSelection?: WalletSelectionBehavior;
  walletType?: WalletType;
};

export type SignInWithOidcIdTokenParams = {
  idToken: string;
  issuer: string;
  audience: string;
  walletSelection?: WalletSelectionBehavior;
  walletType?: WalletType;
  sessionLifetimeSeconds?: number | null;
  provider?: string | null;
  providerLabel?: string | null;
};

export type OidcAuthMode = 'auth-code' | 'auth-code-pkce';

declare const omsRelayOidcProviderBrand: unique symbol;

export type OmsRelayOidcProvider = {
  readonly provider: 'google' | 'apple';
  readonly [omsRelayOidcProviderBrand]: true;
};

export type CustomOidcProviderConfig = {
  issuer: string;
  clientId: string;
  authorizationUrl: string;
  providerRedirectUri: string;
  provider?: string | null;
  providerLabel?: string | null;
  scopes?: string[];
  authorizeParams?: Record<string, string>;
  authMode?: OidcAuthMode;
};

export type OidcProviderConfig =
  | OmsRelayOidcProvider
  | CustomOidcProviderConfig;

type StartOidcRedirectAuthParamsBase = {
  walletType?: WalletType;
  walletSelection?: WalletSelectionBehavior | null;
  sessionLifetimeSeconds?: number | null;
  loginHint?: string | null;
};

export type StartOidcRedirectAuthParams = StartOidcRedirectAuthParamsBase &
  (
    | {
        provider: OmsRelayOidcProvider;
        omsRelayReturnUri: string;
        authorizeParams?: never;
      }
    | {
        provider: CustomOidcProviderConfig;
        omsRelayReturnUri?: never;
        authorizeParams?: Record<string, string> | null;
      }
  );

export type HandleOidcRedirectCallbackParams = {
  callbackUrl: string;
  walletSelection?: WalletSelectionBehavior;
  sessionLifetimeSeconds?: number | null;
};

export type CreateWalletParams = {
  walletType?: WalletType;
  reference?: string | null;
};

export type SignTypedDataParams = {
  network: Network;
  typedData: unknown;
};

export type SignMessageParams = {
  network: Network;
  message: string;
};

export type CallContractArg = {
  type: string;
  value: unknown;
};

export type TransactionMode = 'native' | 'relayer';

export type TransactionStatus =
  | 'quoted'
  | 'pending'
  | 'executed'
  | 'failed'
  | 'unknown';

export type TransactionStatusResolution =
  | 'not-requested'
  | 'resolved'
  | 'timed-out';

export type TransactionStatusPollingOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  fastIntervalMs?: number;
  fastPollCount?: number;
};

export type SendTransactionResponse = {
  txnId: string;
  status: TransactionStatus;
  txnHash: string | null;
  statusResolution: TransactionStatusResolution;
};

export type TransactionStatusResponse = {
  status: TransactionStatus;
  txnHash: string | null;
};

export type FeeToken = {
  network: string;
  name: string;
  symbol: string;
  type: string;
  decimals: number | null;
  logoUrl: string | null;
  contractAddress: string | null;
  tokenId: string | null;
};

export type FeeOption = {
  token: FeeToken;
  value: string;
  displayValue: string;
};

export type FeeOptionSelection = {
  token: string;
};

export type TokenBalancesPage = {
  page: number | null;
  pageSize: number | null;
  more: boolean | null;
};

export type TokenContractInfo = {
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

export type TokenMetadataAsset = {
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

export type TokenMetadata = {
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

export type TokenBalance = {
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

export type FeeOptionWithBalance = {
  feeOption: FeeOption;
  selection: FeeOptionSelection;
  balance: TokenBalance | null;
  available: string | null;
  availableRaw: string | null;
  decimals: number | null;
};

export type FeeOptionSelector = (
  feeOptions: FeeOptionWithBalance[]
) => FeeOptionSelection | null | Promise<FeeOptionSelection | null>;

export type SendTransactionParams = {
  network: Network;
  to: string;
  value: string;
  data?: string | null;
  mode?: TransactionMode;
  selectFeeOption?: FeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: TransactionStatusPollingOptions;
};

export type CallContractParams = {
  network: Network;
  contractAddress: string;
  method: string;
  args?: CallContractArg[] | null;
  mode?: TransactionMode;
  selectFeeOption?: FeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: TransactionStatusPollingOptions;
};

export type IndexerNetworkType = 'MAINNETS' | 'TESTNETS' | 'ALL';

export type ContractVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'ALL';

export type MetadataOptions = {
  verifiedOnly?: boolean;
  unverifiedOnly?: boolean;
  includeContracts?: string[];
};

export type TokenBalancesPageRequest = {
  page?: number;
  pageSize?: number;
};

export type BalancesResult = {
  status: number;
  page?: TokenBalancesPage | null;
  nativeBalances: TokenBalance[];
  balances: TokenBalance[];
};

export type GetBalancesParams = {
  walletAddress: string;
  networks?: Network[];
  networkType?: IndexerNetworkType;
  contractAddresses?: string[];
  includeMetadata?: boolean;
  omitPrices?: boolean | null;
  tokenIds?: string[];
  contractStatus?: ContractVerificationStatus | null;
  page?: TokenBalancesPageRequest;
};

export type TransactionTransfer = {
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

export type Transaction = {
  txnHash: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  chainId: number | null;
  metaTxnId?: string | null;
  transfers?: TransactionTransfer[] | null;
  timestamp?: string | null;
};

export type TransactionHistoryResult = {
  status: number;
  page?: TokenBalancesPage | null;
  transactions: Transaction[];
};

export type GetTransactionHistoryParams = {
  walletAddress: string;
  networks?: Network[];
  networkType?: IndexerNetworkType;
  contractAddresses?: string[];
  transactionHashes?: string[];
  metaTransactionIds?: string[];
  fromBlock?: number | null;
  toBlock?: number | null;
  tokenId?: string | null;
  includeMetadata?: boolean;
  omitPrices?: boolean | null;
  metadataOptions?: MetadataOptions | null;
  page?: TokenBalancesPageRequest;
};

export type IsValidMessageSignatureParams = {
  network: Network;
  message: string;
  signature: string;
};

export type IsValidTypedDataSignatureParams = {
  network: Network;
  typedData: unknown;
  signature: string;
};

export type GetIdTokenParams = {
  ttlSeconds?: number | null;
  customClaims?: Record<string, unknown> | null;
};

export type AccessPage = {
  limit: number | null;
  cursor: string | null;
};

export type ListAccessResponse = {
  credentials: CredentialInfo[];
  page: AccessPage | null;
};

export type ListAccessParams = {
  pageSize?: number | null;
};

export type ListAccessPagesParams = {
  pageSize?: number | null;
};

export type ListAccessPageParams = {
  pageSize?: number | null;
  cursor?: string | null;
};
