import type {
  OmsCredentialInfo,
  OmsFeeOptionSelection,
  OmsFeeOptionWithBalance,
  OmsTokenBalance,
  OmsTokenBalancesPage,
  WalletAccount,
  OmsWalletActivationResult,
} from './NativeOmsWalletReactNativeSdk';
import type { Network } from './networks';

export type {
  OmsAccessPage,
  OmsCredentialInfo,
  OmsFeeOption,
  OmsFeeOptionSelection,
  OmsFeeOptionWithBalance,
  OmsFeeToken,
  OmsListAccessResponse,
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
  WalletAccount,
  OmsWalletActivationResult,
} from './NativeOmsWalletReactNativeSdk';

export type OmsWalletType = 'ethereum';

export type OmsWalletSelectionBehavior = 'automatic' | 'manual';

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

export type SendTransactionParams = {
  network: Network;
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
  walletType: OmsWalletType;
  wallets: WalletAccount[];
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
      wallet: WalletAccount;
      wallets: WalletAccount[];
      credential: OmsCredentialInfo;
      pendingSelection?: undefined;
    }
  | {
      type: 'walletSelection';
      walletAddress: null;
      wallet: null;
      wallets: WalletAccount[];
      credential: OmsCredentialInfo;
      pendingSelection: OmsPendingWalletSelection;
    };

export type OmsOidcRedirectAuthResult =
  | {
      type: 'completed';
      result: OmsCompleteAuthResult;
    }
  | {
      type: 'notOidcRedirectCallback' | 'noPendingAuth';
      result?: undefined;
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
  walletType?: OmsWalletType;
  walletSelection?: OmsWalletSelectionBehavior | null;
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
  callbackUrl?: string | null;
  walletSelection?: OmsWalletSelectionBehavior;
  sessionLifetimeSeconds?: number | null;
};

export type CreateWalletParams = {
  walletType?: OmsWalletType;
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

export type OmsTransactionStatusPollingOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  fastIntervalMs?: number;
  fastPollCount?: number;
};

export type CallContractParams = {
  network: Network;
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
  networks?: Network[];
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
  networks?: Network[];
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
