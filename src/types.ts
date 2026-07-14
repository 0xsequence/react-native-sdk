import type { Network } from './networks';

export type WalletType = 'ethereum';

export type WalletSelectionBehavior = 'automatic' | 'manual';

export type OMSWalletEmailSessionAuth = {
  type: 'email';
  email: string | undefined;
};

export type OMSWalletOidcSessionAuthFlow = 'redirect' | 'id-token';

export type OMSWalletOidcSessionAuth = {
  type: 'oidc';
  flow: OMSWalletOidcSessionAuthFlow;
  issuer: string;
  provider: string | undefined;
  providerLabel: string | undefined;
  email: string | undefined;
};

export type OMSWalletSessionAuth =
  | OMSWalletEmailSessionAuth
  | OMSWalletOidcSessionAuth;

export type OMSWalletSessionState = {
  walletAddress: string | undefined;
  expiresAt: string | undefined;
  auth: OMSWalletSessionAuth | undefined;
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
  reference?: string;
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
  createAndSelectWallet(reference?: string): Promise<WalletActivationResult>;
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
      walletAddress: undefined;
      wallet: undefined;
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
  sessionLifetimeSeconds?: number;
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
  sessionLifetimeSeconds?: number;
  provider?: string;
  providerLabel?: string;
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
  provider?: string;
  providerLabel?: string;
  scopes?: string[];
  authorizeParams?: Record<string, string>;
  authMode?: OidcAuthMode;
};

export type OidcProviderConfig =
  | OmsRelayOidcProvider
  | CustomOidcProviderConfig;

type StartOidcRedirectAuthParamsBase = {
  walletType?: WalletType;
  walletSelection?: WalletSelectionBehavior;
  sessionLifetimeSeconds?: number;
  loginHint?: string;
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
        authorizeParams?: Record<string, string>;
      }
  );

export type HandleOidcRedirectCallbackParams = {
  callbackUrl: string;
  walletSelection?: WalletSelectionBehavior;
  sessionLifetimeSeconds?: number;
};

export type CreateWalletParams = {
  walletType?: WalletType;
  reference?: string;
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
  txnHash?: string;
  statusResolution: TransactionStatusResolution;
};

export type TransactionStatusResponse = {
  status: TransactionStatus;
  txnHash?: string;
};

export type FeeToken = {
  network: string;
  name: string;
  symbol: string;
  type: string;
  decimals?: number;
  logoUrl?: string;
  contractAddress?: string;
  tokenId?: string;
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
  page?: number;
  pageSize?: number;
  more?: boolean;
};

export type TokenContractInfo = {
  chainId?: number;
  address?: string;
  source?: string;
  name?: string;
  type?: string;
  symbol?: string;
  decimals?: number;
  logoURI?: string;
  deployed?: boolean;
  bytecodeHash?: string;
  extensions?: Record<string, unknown>;
  updatedAt?: string;
  queuedAt?: string;
  status?: string;
};

export type TokenMetadataAsset = {
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

export type TokenMetadata = {
  chainId?: number;
  contractAddress?: string;
  tokenId?: string;
  source?: string;
  name?: string;
  description?: string;
  image?: string;
  video?: string;
  audio?: string;
  properties?: Record<string, unknown>;
  attributes?: Record<string, unknown>[];
  imageData?: string;
  externalUrl?: string;
  backgroundColor?: string;
  animationUrl?: string;
  decimals?: number;
  updatedAt?: string;
  assets?: TokenMetadataAsset[];
  status?: string;
  queuedAt?: string;
  lastFetched?: string;
};

export type TokenBalance = {
  contractType?: string;
  contractAddress?: string;
  accountAddress?: string;
  tokenId?: string;
  balance?: string;
  blockHash?: string;
  blockNumber?: number;
  chainId?: number;
  name?: string;
  symbol?: string;
  balanceUSD?: string;
  priceUSD?: string;
  priceUpdatedAt?: string;
  uniqueCollectibles?: string;
  isSummary?: boolean;
  contractInfo?: TokenContractInfo;
  tokenMetadata?: TokenMetadata;
};

export type FeeOptionWithBalance = {
  feeOption: FeeOption;
  selection: FeeOptionSelection;
  balance?: TokenBalance;
  available?: string;
  availableRaw?: string;
  decimals?: number;
};

export type FeeOptionSelector = (
  feeOptions: FeeOptionWithBalance[]
) => FeeOptionSelection | undefined | Promise<FeeOptionSelection | undefined>;

export type SendTransactionParams = {
  network: Network;
  to: string;
  value: string;
  data?: string;
  mode?: TransactionMode;
  selectFeeOption?: FeeOptionSelector;
  waitForStatus?: boolean;
  statusPolling?: TransactionStatusPollingOptions;
};

export type CallContractParams = {
  network: Network;
  contractAddress: string;
  method: string;
  args?: CallContractArg[];
  mode?: TransactionMode;
  selectFeeOption?: FeeOptionSelector;
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
  page?: TokenBalancesPage;
  nativeBalances: TokenBalance[];
  balances: TokenBalance[];
};

export type GetBalancesParams = {
  walletAddress: string;
  networks?: Network[];
  networkType?: IndexerNetworkType;
  contractAddresses?: string[];
  includeMetadata?: boolean;
  omitPrices?: boolean;
  tokenIds?: string[];
  contractStatus?: ContractVerificationStatus;
  page?: TokenBalancesPageRequest;
};

export type TransactionTransfer = {
  transferType?: string;
  contractAddress?: string;
  contractType?: string;
  from?: string;
  to?: string;
  tokenIds?: string[];
  amounts?: string[];
  logIndex?: number;
  amountsUSD?: string[];
  pricesUSD?: string[];
  contractInfo?: TokenContractInfo;
  tokenMetadata?: Record<string, unknown>;
};

export type Transaction = {
  txnHash: string;
  blockNumber: number;
  blockHash: string;
  chainId: number;
  metaTxnId?: string;
  transfers?: TransactionTransfer[];
  timestamp: string;
};

export type TransactionHistoryResult = {
  status: number;
  page?: TokenBalancesPage;
  transactions: Transaction[];
};

export type GetTransactionHistoryParams = {
  walletAddress: string;
  networks?: Network[];
  networkType?: IndexerNetworkType;
  contractAddresses?: string[];
  transactionHashes?: string[];
  metaTransactionIds?: string[];
  fromBlock?: number;
  toBlock?: number;
  tokenId?: string;
  includeMetadata?: boolean;
  omitPrices?: boolean;
  metadataOptions?: MetadataOptions;
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
  ttlSeconds?: number;
  customClaims?: Record<string, unknown>;
};

export type AccessPage = {
  limit?: number;
  cursor?: string;
};

export type ListAccessResponse = {
  credentials: CredentialInfo[];
  page?: AccessPage;
};

export type ListAccessParams = {
  pageSize?: number;
};

export type ListAccessPagesParams = {
  pageSize?: number;
};

export type ListAccessPageParams = {
  pageSize?: number;
  cursor?: string;
};
