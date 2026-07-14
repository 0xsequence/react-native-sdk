import {
  TurboModuleRegistry,
  type CodegenTypes,
  type TurboModule,
} from 'react-native';

export type OmsNativeNetwork = {
  chainId: string;
  name: string;
  nativeTokenSymbol: string;
  explorerUrl: string;
  displayName: string;
};

export type OmsNativeWalletAccount = {
  id: string;
  type: string;
  address: string;
  reference: string | null;
};

export type OmsNativeWalletActivationResult = {
  walletAddress: string;
  wallet: OmsNativeWalletAccount;
};

export type OmsNativePendingWalletSelection = {
  id: string;
  walletType: string;
  wallets: OmsNativeWalletAccount[];
  credential: OmsNativeCredentialInfo;
};

export type OmsNativeCompleteAuthResult = {
  type: string;
  walletAddress: string | null;
  wallet?: OmsNativeWalletAccount;
  wallets: OmsNativeWalletAccount[];
  credential: OmsNativeCredentialInfo;
  pendingSelection?: OmsNativePendingWalletSelection;
};

export type OmsNativeStartOidcRedirectAuthResult = {
  authorizationUrl: string;
};

export type OmsNativeOidcRedirectAuthResult = {
  type: string;
  result?: OmsNativeCompleteAuthResult;
};

export type OmsNativeSessionAuth = {
  type: string;
  flow?: string | null;
  issuer?: string | null;
  provider?: string | null;
  providerLabel?: string | null;
  email: string | null;
};

export type OmsNativeSessionState = {
  walletAddress: string | null;
  expiresAt: string | null;
  auth: OmsNativeSessionAuth | null;
};

export type OmsNativeSessionExpiredEvent = {
  clientId: string;
  session: OmsNativeSessionState;
  expiredAt: string;
};

export type OmsNativeTokenBalancesPage = {
  page: number | null;
  pageSize: number | null;
  more: boolean | null;
};

export type OmsNativeTokenBalance = {
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
  contractInfo?: OmsNativeTokenContractInfo | null;
  tokenMetadata?: OmsNativeTokenMetadata | null;
};

export type OmsNativeTokenContractInfo = {
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
  extensions?: CodegenTypes.UnsafeObject | null;
  updatedAt?: string | null;
  queuedAt?: string | null;
  status?: string | null;
};

export type OmsNativeTokenMetadataAsset = {
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

export type OmsNativeTokenMetadata = {
  chainId?: number | null;
  contractAddress?: string | null;
  tokenId?: string | null;
  source?: string | null;
  name?: string | null;
  description?: string | null;
  image?: string | null;
  video?: string | null;
  audio?: string | null;
  properties?: CodegenTypes.UnsafeObject | null;
  attributes?: CodegenTypes.UnsafeObject[] | null;
  imageData?: string | null;
  externalUrl?: string | null;
  backgroundColor?: string | null;
  animationUrl?: string | null;
  decimals?: number | null;
  updatedAt?: string | null;
  assets?: OmsNativeTokenMetadataAsset[] | null;
  status?: string | null;
  queuedAt?: string | null;
  lastFetched?: string | null;
};

export type OmsNativeBalancesResult = {
  status: number;
  page?: OmsNativeTokenBalancesPage | null;
  nativeBalances: OmsNativeTokenBalance[];
  balances: OmsNativeTokenBalance[];
};

export type OmsNativeTransactionTransfer = {
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
  contractInfo?: OmsNativeTokenContractInfo | null;
  tokenMetadata?: CodegenTypes.UnsafeObject | null;
};

export type OmsNativeTransaction = {
  txnHash: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  chainId: number | null;
  metaTxnId?: string | null;
  transfers?: OmsNativeTransactionTransfer[] | null;
  timestamp?: string | null;
};

export type OmsNativeTransactionHistoryResult = {
  status: number;
  page?: OmsNativeTokenBalancesPage | null;
  transactions: OmsNativeTransaction[];
};

export type OmsNativeTransactionStatus = {
  status: string;
  txnHash: string | null;
};

export type OmsNativeSendTransactionResponse = {
  txnId: string;
  status: string;
  txnHash: string | null;
  statusResolution: 'not-requested' | 'resolved' | 'timed-out';
};

export type OmsNativeFeeToken = {
  network: string;
  name: string;
  symbol: string;
  type: string;
  decimals: number | null;
  logoUrl: string | null;
  contractAddress: string | null;
  tokenId: string | null;
};

export type OmsNativeFeeOption = {
  token: OmsNativeFeeToken;
  value: string;
  displayValue: string;
};

export type OmsNativeFeeOptionSelection = {
  token: string;
};

export type OmsNativeFeeOptionWithBalance = {
  feeOption: OmsNativeFeeOption;
  selection: OmsNativeFeeOptionSelection;
  balance: OmsNativeTokenBalance | null;
  available: string | null;
  availableRaw: string | null;
  decimals: number | null;
};

export type OmsNativeFeeOptionSelectionRequest = {
  selectorId: string;
  requestId: string;
  options: OmsNativeFeeOptionWithBalance[];
};

export type OmsNativeCredentialInfo = {
  credentialId: string;
  expiresAt: string;
  isCaller: boolean;
};

export type OmsNativeAccessPage = {
  limit: number | null;
  cursor: string | null;
};

export type OmsNativeListAccessResponse = {
  credentials: OmsNativeCredentialInfo[];
  page: OmsNativeAccessPage | null;
};

export interface Spec extends TurboModule {
  readonly onFeeOptionSelectionRequest: CodegenTypes.EventEmitter<OmsNativeFeeOptionSelectionRequest>;
  readonly onSessionExpired: CodegenTypes.EventEmitter<OmsNativeSessionExpiredEvent>;

  createClient(clientId: string, publishableKey: string): Promise<void>;
  getWalletAddress(clientId: string): Promise<string | null>;
  getSession(clientId: string): Promise<OmsNativeSessionState>;
  startEmailAuth(
    clientId: string,
    email: string,
    sessionLifetimeSeconds: string | null
  ): Promise<void>;
  completeEmailAuth(
    clientId: string,
    code: string,
    walletSelection: string | null,
    walletType: string | null
  ): Promise<OmsNativeCompleteAuthResult>;
  signInWithOidcIdToken(
    clientId: string,
    idToken: string,
    issuer: string,
    audience: string,
    walletSelection: string | null,
    walletType: string | null,
    sessionLifetimeSeconds: string | null,
    provider: string | null,
    providerLabel: string | null
  ): Promise<OmsNativeCompleteAuthResult>;
  startOidcRedirectAuth(
    clientId: string,
    providerJson: string,
    omsRelayReturnUri: string | null,
    walletType: string | null,
    walletSelection: string | null,
    sessionLifetimeSeconds: string | null,
    authorizeParamsJson: string | null,
    loginHint: string | null
  ): Promise<OmsNativeStartOidcRedirectAuthResult>;
  handleOidcRedirectCallback(
    clientId: string,
    callbackUrl: string,
    walletSelection: string | null,
    sessionLifetimeSeconds: string | null
  ): Promise<OmsNativeOidcRedirectAuthResult>;
  listWallets(clientId: string): Promise<OmsNativeWalletAccount[]>;
  useWallet(
    clientId: string,
    walletId: string
  ): Promise<OmsNativeWalletActivationResult>;
  createWallet(
    clientId: string,
    walletType: string | null,
    reference: string | null
  ): Promise<OmsNativeWalletActivationResult>;
  selectWalletForPendingSelection(
    clientId: string,
    pendingSelectionId: string,
    walletId: string
  ): Promise<OmsNativeWalletActivationResult>;
  createAndSelectWalletForPendingSelection(
    clientId: string,
    pendingSelectionId: string,
    reference: string | null
  ): Promise<OmsNativeWalletActivationResult>;
  signOut(clientId: string): Promise<void>;
  signMessage(
    clientId: string,
    chainId: string,
    message: string
  ): Promise<string>;
  signTypedData(
    clientId: string,
    chainId: string,
    typedDataJson: string
  ): Promise<string>;
  sendTransaction(
    clientId: string,
    chainId: string,
    to: string,
    value: string,
    data: string | null,
    mode: string | null,
    feeOptionSelectorId: string | null,
    waitForStatus: boolean,
    statusPollingTimeoutMs: string | null,
    statusPollingIntervalMs: string | null,
    statusPollingFastIntervalMs: string | null,
    statusPollingFastPollCount: string | null
  ): Promise<OmsNativeSendTransactionResponse>;
  callContract(
    clientId: string,
    chainId: string,
    contractAddress: string,
    method: string,
    argsJson: string | null,
    mode: string | null,
    feeOptionSelectorId: string | null,
    waitForStatus: boolean,
    statusPollingTimeoutMs: string | null,
    statusPollingIntervalMs: string | null,
    statusPollingFastIntervalMs: string | null,
    statusPollingFastPollCount: string | null
  ): Promise<OmsNativeSendTransactionResponse>;
  respondToFeeOptionSelection(
    requestId: string,
    selectionToken: string | null,
    errorMessage: string | null
  ): Promise<void>;
  getTransactionStatus(
    clientId: string,
    txnId: string
  ): Promise<OmsNativeTransactionStatus>;
  getBalances(
    clientId: string,
    paramsJson: string
  ): Promise<OmsNativeBalancesResult>;
  getTransactionHistory(
    clientId: string,
    paramsJson: string
  ): Promise<OmsNativeTransactionHistoryResult>;
  verifyMessageSignature(
    clientId: string,
    chainId: string,
    message: string,
    signature: string
  ): Promise<boolean>;
  verifyTypedDataSignature(
    clientId: string,
    chainId: string,
    typedDataJson: string,
    signature: string
  ): Promise<boolean>;
  getIdToken(
    clientId: string,
    ttlSeconds: string | null,
    customClaimsJson: string | null
  ): Promise<string>;
  listAccess(
    clientId: string,
    pageSize: string | null
  ): Promise<OmsNativeCredentialInfo[]>;
  listAccessPage(
    clientId: string,
    pageSize: string | null,
    cursor: string | null
  ): Promise<OmsNativeListAccessResponse>;
  revokeAccess(clientId: string, targetCredentialId: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  'OmsWalletReactNativeSdk'
);
