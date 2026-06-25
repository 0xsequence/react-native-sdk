import type {
  OmsCredentialInfo,
  OmsFeeOptionSelection,
  OmsFeeOptionWithBalance,
  OmsNetwork,
  OmsTokenBalance,
  OmsTokenBalancesPage,
  OmsWallet,
  OmsWalletActivationResult,
} from './NativeOmsClientReactNativeSdk';

export type {
  OmsAccessPage,
  OmsCredentialInfo,
  OmsFeeOption,
  OmsFeeOptionSelection,
  OmsFeeOptionWithBalance,
  OmsFeeToken,
  OmsListAccessResponse,
  OmsNetwork,
  OmsSendTransactionResponse,
  OmsStartOidcRedirectAuthResult,
  OmsTokenBalance,
  OmsTokenBalancesPage,
  OmsTokenContractInfo,
  OmsTokenMetadata,
  OmsTokenMetadataAsset,
  OmsTransaction,
  OmsTransactionHistoryResult,
  OmsTransactionStatus,
  OmsTransactionTransfer,
  OmsWallet,
  OmsWalletActivationResult,
} from './NativeOmsClientReactNativeSdk';

export type OmsClientSessionLoginType = 'Email' | 'GoogleAuth' | 'Oidc';

export type OmsWalletType = 'ethereum';

export type OmsWalletSelectionBehavior = 'automatic' | 'manual';

export type OmsClientSessionState = {
  walletAddress: string | null;
  expiresAt: string | null;
  loginType: OmsClientSessionLoginType | null;
  sessionEmail: string | null;
};

export type OmsClientSessionExpiredEvent = {
  session: OmsClientSessionState;
  expiredAt: string;
};

export type OmsClientConfig = {
  publishableKey: string;
};

export type SendTransactionParams = {
  chainId: string;
  to: string;
  value: string;
  data?: string | null;
  mode?: OmsTransactionMode;
  selectFeeOption?: OmsFeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: OmsTransactionStatusPollingOptions;
};

export type OmsTransactionMode = 'native' | 'relayer';

export type OmsFeeOptionSelector = (
  feeOptions: OmsFeeOptionWithBalance[]
) => OmsFeeOptionSelection | null | Promise<OmsFeeOptionSelection | null>;

export type OmsPendingWalletSelection = {
  id: string;
  walletType: OmsWalletType;
  wallets: OmsWallet[];
  credential: OmsCredentialInfo;
  selectWallet(walletId: string): Promise<OmsWalletActivationResult>;
  createAndSelectWallet(
    reference?: string | null
  ): Promise<OmsWalletActivationResult>;
};

export type OmsCompleteAuthResult =
  | {
      type: 'walletSelected';
      walletAddress: string;
      wallet: OmsWallet;
      wallets: OmsWallet[];
      credential: OmsCredentialInfo;
      pendingSelection?: undefined;
    }
  | {
      type: 'walletSelection';
      walletAddress: null;
      wallet: null;
      wallets: OmsWallet[];
      credential: OmsCredentialInfo;
      pendingSelection: OmsPendingWalletSelection;
    };

export type OmsOidcRedirectAuthResult =
  | {
      type: 'completed';
      wallet: OmsWallet;
      pendingSelection?: undefined;
      message?: undefined;
    }
  | {
      type: 'walletSelection';
      pendingSelection: OmsPendingWalletSelection;
      wallet?: undefined;
      message?: undefined;
    }
  | {
      type: 'notOidcRedirectCallback' | 'noPendingAuth';
      wallet?: undefined;
      pendingSelection?: undefined;
      message?: undefined;
    }
  | {
      type: 'failed';
      message: string;
      wallet?: undefined;
      pendingSelection?: undefined;
    };

export type CompleteEmailAuthParams = {
  code: string;
  walletSelection?: OmsWalletSelectionBehavior;
  walletType?: OmsWalletType;
  sessionLifetimeSeconds?: number | null;
};

export type SignInWithOidcIdTokenParams = {
  idToken: string;
  issuer: string;
  audience: string;
  walletSelection?: OmsWalletSelectionBehavior;
  walletType?: OmsWalletType;
  sessionLifetimeSeconds?: number | null;
};

export type OidcProviderConfig = {
  issuer: string;
  clientId: string;
  authorizationUrl: string;
  scopes?: string[];
  relayRedirectUri?: string | null;
  authorizeParams?: Record<string, string>;
};

export type GoogleOidcProviderParams = {
  clientId?: string;
  relayRedirectUri?: string | null;
  scopes?: string[];
  authorizeParams?: Record<string, string>;
};

export type StartOidcRedirectAuthParams = {
  provider: OidcProviderConfig;
  redirectUri: string;
  walletType?: OmsWalletType;
  relayRedirectUri?: string | null;
  authorizeParams?: Record<string, string> | null;
  loginHint?: string | null;
};

export type HandleOidcRedirectCallbackParams = {
  callbackUrl?: string | null;
  walletSelection?: OmsWalletSelectionBehavior;
  sessionLifetimeSeconds?: number | null;
};

export type CreateWalletParams = {
  walletType?: OmsWalletType;
  reference?: string | null;
};

export type SignTypedDataParams = {
  chainId: string;
  typedData: unknown;
};

export type CallContractArg = {
  type: string;
  value: unknown;
};

export type OmsTransactionStatusPollingOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  fastIntervalMs?: number;
  fastPollCount?: number;
};

export type CallContractParams = {
  chainId: string;
  contractAddress: string;
  method: string;
  args?: CallContractArg[] | null;
  mode?: OmsTransactionMode;
  selectFeeOption?: OmsFeeOptionSelector | null;
  waitForStatus?: boolean;
  statusPolling?: OmsTransactionStatusPollingOptions;
};

export type OmsIndexerNetworkType = 'MAINNETS' | 'TESTNETS' | 'ALL';

export type OmsContractVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'ALL';

export type OmsMetadataOptions = {
  verifiedOnly?: boolean;
  unverifiedOnly?: boolean;
  includeContracts?: string[];
};

export type OmsTokenBalancesPageRequest = {
  page?: number;
  pageSize?: number;
};

export type OmsBalancesResult = {
  status: number;
  page?: OmsTokenBalancesPage | null;
  nativeBalances: OmsTokenBalance[];
  balances: OmsTokenBalance[];
};

export type GetBalancesParams = {
  walletAddress: string;
  networks?: OmsNetwork[];
  networkType?: OmsIndexerNetworkType;
  contractAddresses?: string[];
  includeMetadata?: boolean;
  omitPrices?: boolean | null;
  tokenIds?: string[];
  contractStatus?: OmsContractVerificationStatus | null;
  page?: OmsTokenBalancesPageRequest;
};

export type GetTransactionHistoryParams = {
  walletAddress: string;
  networks?: OmsNetwork[];
  networkType?: OmsIndexerNetworkType;
  contractAddresses?: string[];
  transactionHashes?: string[];
  metaTransactionIds?: string[];
  fromBlock?: number | null;
  toBlock?: number | null;
  tokenId?: string | null;
  includeMetadata?: boolean;
  omitPrices?: boolean | null;
  metadataOptions?: OmsMetadataOptions | null;
  page?: OmsTokenBalancesPageRequest;
};

export type VerifyMessageSignatureParams = {
  chainId: string;
  message: string;
  signature: string;
};

export type VerifyTypedDataSignatureParams = {
  chainId: string;
  typedData: unknown;
  signature: string;
};

export type GetIdTokenParams = {
  ttlSeconds?: number | null;
  customClaims?: Record<string, unknown> | null;
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
