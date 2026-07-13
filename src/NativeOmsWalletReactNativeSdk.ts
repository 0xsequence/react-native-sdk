import {
  TurboModuleRegistry,
  type CodegenTypes,
  type TurboModule,
} from 'react-native';

export type OmsNetwork = {
  chainId: string;
  name: string;
  nativeTokenSymbol: string;
  explorerUrl: string;
  displayName: string;
};

export type OmsWallet = {
  id: string;
  type: string;
  address: string;
  reference: string | null;
};

export type OmsWalletActivationResult = {
  walletAddress: string;
  wallet: OmsWallet;
};

export type OmsNativePendingWalletSelection = {
  id: string;
  walletType: string;
  wallets: OmsWallet[];
  credential: OmsCredentialInfo;
};

export type OmsNativeCompleteAuthResult = {
  type: string;
  walletAddress: string | null;
  wallet?: OmsWallet;
  wallets: OmsWallet[];
  credential: OmsCredentialInfo;
  pendingSelection?: OmsNativePendingWalletSelection;
};

export type OmsStartOidcRedirectAuthResult = {
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

export type OMSWalletSessionState = {
  walletAddress: string | null;
  expiresAt: string | null;
  auth: OmsNativeSessionAuth | null;
};

export type OMSWalletSessionExpiredEvent = {
  clientId: string;
  session: OMSWalletSessionState;
  expiredAt: string;
};

export type OmsTokenBalancesPage = {
  page: number | null;
  pageSize: number | null;
  more: boolean | null;
};

export type OmsTokenBalance = {
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

export type OmsTokenContractInfo = {
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

export type OmsTokenMetadataAsset = {
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

export type OmsTokenMetadata = {
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
  assets?: OmsTokenMetadataAsset[] | null;
  status?: string | null;
  queuedAt?: string | null;
  lastFetched?: string | null;
};

export type OmsBalancesResult = {
  status: number;
  page?: OmsTokenBalancesPage | null;
  nativeBalances: OmsTokenBalance[];
  balances: OmsTokenBalance[];
};

export type OmsTransactionTransfer = {
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
  tokenMetadata?: CodegenTypes.UnsafeObject | null;
};

export type OmsTransaction = {
  txnHash: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  chainId: number | null;
  metaTxnId?: string | null;
  transfers?: OmsTransactionTransfer[] | null;
  timestamp?: string | null;
};

export type OmsTransactionHistoryResult = {
  status: number;
  page?: OmsTokenBalancesPage | null;
  transactions: OmsTransaction[];
};

export type OmsTransactionStatus = {
  status: string;
  txnHash: string | null;
};

export type OmsSendTransactionResponse = {
  txnId: string;
  status: string;
  txnHash: string | null;
  statusResolution: 'not-requested' | 'resolved' | 'timed-out';
};

export type OmsFeeToken = {
  network: string;
  name: string;
  symbol: string;
  type: string;
  decimals: number | null;
  logoUrl: string | null;
  contractAddress: string | null;
  tokenId: string | null;
};

export type OmsFeeOption = {
  token: OmsFeeToken;
  value: string;
  displayValue: string;
};

export type OmsFeeOptionSelection = {
  token: string;
};

export type OmsFeeOptionWithBalance = {
  feeOption: OmsFeeOption;
  selection: OmsFeeOptionSelection;
  balance: OmsTokenBalance | null;
  available: string | null;
  availableRaw: string | null;
  decimals: number | null;
};

export type OmsFeeOptionSelectionRequest = {
  selectorId: string;
  requestId: string;
  options: OmsFeeOptionWithBalance[];
};

export type OmsCredentialInfo = {
  credentialId: string;
  expiresAt: string;
  isCaller: boolean;
};

export type OmsAccessPage = {
  limit: number | null;
  cursor: string | null;
};

export type OmsListAccessResponse = {
  credentials: OmsCredentialInfo[];
  page: OmsAccessPage | null;
};

export interface Spec extends TurboModule {
  readonly onFeeOptionSelectionRequest: CodegenTypes.EventEmitter<OmsFeeOptionSelectionRequest>;
  readonly onSessionExpired: CodegenTypes.EventEmitter<OMSWalletSessionExpiredEvent>;

  createClient(clientId: string, publishableKey: string): Promise<void>;
  getWalletAddress(clientId: string): Promise<string | null>;
  getSession(clientId: string): Promise<OMSWalletSessionState>;
  startEmailAuth(clientId: string, email: string): Promise<void>;
  completeEmailAuth(
    clientId: string,
    code: string,
    walletSelection: string | null,
    walletType: string | null,
    sessionLifetimeSeconds: string | null
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
  ): Promise<OmsStartOidcRedirectAuthResult>;
  handleOidcRedirectCallback(
    clientId: string,
    callbackUrl: string | null,
    walletSelection: string | null,
    sessionLifetimeSeconds: string | null
  ): Promise<OmsNativeOidcRedirectAuthResult>;
  listWallets(clientId: string): Promise<OmsWallet[]>;
  useWallet(
    clientId: string,
    walletId: string
  ): Promise<OmsWalletActivationResult>;
  createWallet(
    clientId: string,
    walletType: string | null,
    reference: string | null
  ): Promise<OmsWalletActivationResult>;
  selectWalletForPendingSelection(
    clientId: string,
    pendingSelectionId: string,
    walletId: string
  ): Promise<OmsWalletActivationResult>;
  createAndSelectWalletForPendingSelection(
    clientId: string,
    pendingSelectionId: string,
    reference: string | null
  ): Promise<OmsWalletActivationResult>;
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
  ): Promise<OmsSendTransactionResponse>;
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
  ): Promise<OmsSendTransactionResponse>;
  respondToFeeOptionSelection(
    requestId: string,
    selectionToken: string | null,
    errorMessage: string | null
  ): Promise<void>;
  getTransactionStatus(
    clientId: string,
    txnId: string
  ): Promise<OmsTransactionStatus>;
  getBalances(clientId: string, paramsJson: string): Promise<OmsBalancesResult>;
  getTransactionHistory(
    clientId: string,
    paramsJson: string
  ): Promise<OmsTransactionHistoryResult>;
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
  ): Promise<OmsCredentialInfo[]>;
  listAccessPage(
    clientId: string,
    pageSize: string | null,
    cursor: string | null
  ): Promise<OmsListAccessResponse>;
  revokeAccess(clientId: string, targetCredentialId: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  'OmsWalletReactNativeSdk'
);
