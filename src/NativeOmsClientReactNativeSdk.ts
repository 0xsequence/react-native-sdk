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
  state: string;
  challenge: string;
};

export type OmsNativeOidcRedirectAuthResult = {
  type: string;
  wallet?: OmsWallet;
  pendingSelection?: OmsNativePendingWalletSelection;
  message?: string;
};

export type OmsClientSessionState = {
  walletAddress: string | null;
  expiresAt: string | null;
  loginType: string | null;
  sessionEmail: string | null;
};

export type OmsTokenBalancesPage = {
  page: number;
  pageSize: number;
  more: boolean;
};

export type OmsTokenBalance = {
  contractType: string | null;
  contractAddress: string | null;
  accountAddress: string | null;
  tokenId: string | null;
  balance: string | null;
  balanceUSD?: string | null;
  priceUSD?: string | null;
  priceUpdatedAt?: string | null;
  blockHash: string | null;
  blockNumber?: number | null;
  chainId?: number | null;
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

export type OmsTokenBalancesResult = {
  status: number;
  page?: OmsTokenBalancesPage;
  balances: OmsTokenBalance[];
};

export type OmsTransactionStatus = {
  status: string;
  txnHash: string | null;
};

export type OmsSendTransactionResponse = {
  txnId: string;
  status: string;
  txnHash: string | null;
};

export type OmsFeeToken = {
  network: string;
  name: string;
  symbol: string;
  type: string;
  decimals: number | null;
  logoUrl: string;
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

export type OmsClientSessionExpiredEvent = {
  session: OmsClientSessionState;
  expiredAt: string;
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
  readonly onSessionExpired: CodegenTypes.EventEmitter<OmsClientSessionExpiredEvent>;
  configure(
    publishableKey: string,
    walletApiUrl: string | null,
    apiRpcUrl: string | null,
    indexerUrlTemplate: string | null,
    projectId: string
  ): Promise<void>;
  getWalletAddress(): Promise<string | null>;
  getSession(): Promise<OmsClientSessionState>;
  getSupportedNetworks(): Promise<OmsNetwork[]>;
  startEmailAuth(email: string): Promise<void>;
  completeEmailAuth(
    code: string,
    walletSelection: string | null,
    walletType: string | null,
    sessionLifetimeSeconds: string | null
  ): Promise<OmsNativeCompleteAuthResult>;
  signInWithOidcIdToken(
    idToken: string,
    issuer: string,
    audience: string,
    walletSelection: string | null,
    walletType: string | null,
    sessionLifetimeSeconds: string | null
  ): Promise<OmsNativeCompleteAuthResult>;
  startOidcRedirectAuth(
    providerJson: string,
    redirectUri: string,
    walletType: string | null,
    relayRedirectUri: string | null,
    authorizeParamsJson: string | null,
    loginHint: string | null
  ): Promise<OmsStartOidcRedirectAuthResult>;
  handleOidcRedirectCallback(
    callbackUrl: string | null,
    walletSelection: string | null,
    sessionLifetimeSeconds: string | null
  ): Promise<OmsNativeOidcRedirectAuthResult>;
  listWallets(): Promise<OmsWallet[]>;
  useWallet(walletId: string): Promise<OmsWalletActivationResult>;
  createWallet(
    walletType: string | null,
    reference: string | null
  ): Promise<OmsWalletActivationResult>;
  selectWalletForPendingSelection(
    pendingSelectionId: string,
    walletId: string
  ): Promise<OmsWalletActivationResult>;
  createAndSelectWalletForPendingSelection(
    pendingSelectionId: string,
    reference: string | null
  ): Promise<OmsWalletActivationResult>;
  signOut(): Promise<void>;
  signMessage(chainId: string, message: string): Promise<string>;
  signTypedData(chainId: string, typedDataJson: string): Promise<string>;
  sendTransaction(
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
  getTransactionStatus(txnId: string): Promise<OmsTransactionStatus>;
  getTokenBalances(
    chainId: string,
    contractAddress: string | null,
    walletAddress: string,
    includeMetadata: boolean,
    page: string | null,
    pageSize: string | null
  ): Promise<OmsTokenBalancesResult>;
  getNativeTokenBalance(
    chainId: string,
    walletAddress: string
  ): Promise<OmsTokenBalance | null>;
  verifyMessageSignature(
    chainId: string,
    message: string,
    signature: string
  ): Promise<boolean>;
  verifyTypedDataSignature(
    chainId: string,
    typedDataJson: string,
    signature: string
  ): Promise<boolean>;
  getIdToken(
    ttlSeconds: string | null,
    customClaimsJson: string | null
  ): Promise<string>;
  listAccess(pageSize: string | null): Promise<OmsCredentialInfo[]>;
  listAccessPage(
    pageSize: string | null,
    cursor: string | null
  ): Promise<OmsListAccessResponse>;
  revokeAccess(targetCredentialId: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  'OmsClientReactNativeSdk'
);
