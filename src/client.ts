import type { EventSubscription } from 'react-native';
import { supportedNetworks } from './networks';
import type {
  CallContractParams,
  CompleteEmailAuthParams,
  CreateWalletParams,
  GetBalancesParams,
  GetIdTokenParams,
  GetTransactionHistoryParams,
  HandleOidcRedirectCallbackParams,
  ListAccessPageParams,
  ListAccessPagesParams,
  ListAccessParams,
  OmsBalancesResult,
  OmsClientConfig,
  OmsClientSessionExpiredEvent,
  OmsClientSessionState,
  OmsCompleteAuthResult,
  OmsCredentialInfo,
  OmsListAccessResponse,
  OmsNetwork,
  OmsOidcRedirectAuthResult,
  OmsSendTransactionResponse,
  OmsStartOidcRedirectAuthResult,
  OmsTransactionHistoryResult,
  OmsTransactionStatus,
  OmsWallet,
  OmsWalletActivationResult,
  SendTransactionParams,
  SignInWithOidcIdTokenParams,
  SignTypedDataParams,
  StartOidcRedirectAuthParams,
  VerifyMessageSignatureParams,
  VerifyTypedDataSignatureParams,
} from './types';

function unsupported(): never {
  throw new Error(
    "'@0xsequence/oms-react-native-sdk' is only supported on native platforms."
  );
}

export class OMSClient {
  public readonly wallet: OMSWalletClient;
  public readonly indexer: OMSIndexerClient;
  public readonly supportedNetworks: OmsNetwork[] = supportedNetworks;

  constructor(_config: OmsClientConfig) {
    this.wallet = new OMSWalletClient();
    this.indexer = new OMSIndexerClient();
  }
}

export class OMSWalletClient {
  getWalletAddress(): Promise<string | null> {
    unsupported();
  }

  getSession(): Promise<OmsClientSessionState> {
    unsupported();
  }

  onSessionExpired(
    _listener: (event: OmsClientSessionExpiredEvent) => void
  ): EventSubscription {
    unsupported();
  }

  startEmailAuth(_email: string): Promise<void> {
    unsupported();
  }

  completeEmailAuth(
    _params: CompleteEmailAuthParams
  ): Promise<OmsCompleteAuthResult> {
    unsupported();
  }

  signInWithOidcIdToken(
    _params: SignInWithOidcIdTokenParams
  ): Promise<OmsCompleteAuthResult> {
    unsupported();
  }

  startOidcRedirectAuth(
    _params: StartOidcRedirectAuthParams
  ): Promise<OmsStartOidcRedirectAuthResult> {
    unsupported();
  }

  handleOidcRedirectCallback(
    _params: HandleOidcRedirectCallbackParams = {}
  ): Promise<OmsOidcRedirectAuthResult> {
    unsupported();
  }

  listWallets(): Promise<OmsWallet[]> {
    unsupported();
  }

  useWallet(_walletId: string): Promise<OmsWalletActivationResult> {
    unsupported();
  }

  createWallet(
    _params: CreateWalletParams = {}
  ): Promise<OmsWalletActivationResult> {
    unsupported();
  }

  signOut(): Promise<void> {
    unsupported();
  }

  signMessage(_chainId: string, _message: string): Promise<string> {
    unsupported();
  }

  signTypedData(_params: SignTypedDataParams): Promise<string> {
    unsupported();
  }

  sendTransaction(
    _params: SendTransactionParams
  ): Promise<OmsSendTransactionResponse> {
    unsupported();
  }

  callContract(
    _params: CallContractParams
  ): Promise<OmsSendTransactionResponse> {
    unsupported();
  }

  getTransactionStatus(_txnId: string): Promise<OmsTransactionStatus> {
    unsupported();
  }

  verifyMessageSignature(
    _params: VerifyMessageSignatureParams
  ): Promise<boolean> {
    unsupported();
  }

  verifyTypedDataSignature(
    _params: VerifyTypedDataSignatureParams
  ): Promise<boolean> {
    unsupported();
  }

  getIdToken(_params: GetIdTokenParams = {}): Promise<string> {
    unsupported();
  }

  listAccess(_params: ListAccessParams = {}): Promise<OmsCredentialInfo[]> {
    unsupported();
  }

  async *listAccessPages(
    _params: ListAccessPagesParams = {}
  ): AsyncGenerator<OmsListAccessResponse, void, void> {
    unsupported();
  }

  listAccessPage(
    _params: ListAccessPageParams = {}
  ): Promise<OmsListAccessResponse> {
    unsupported();
  }

  revokeAccess(_targetCredentialId: string): Promise<void> {
    unsupported();
  }
}

export class OMSIndexerClient {
  getBalances(_params: GetBalancesParams): Promise<OmsBalancesResult> {
    unsupported();
  }

  getTransactionHistory(
    _params: GetTransactionHistoryParams
  ): Promise<OmsTransactionHistoryResult> {
    unsupported();
  }
}
