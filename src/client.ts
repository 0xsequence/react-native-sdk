import type { EventSubscription } from 'react-native';
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
  OMSWalletParams,
  OMSWalletSessionExpiredEvent,
  OMSWalletSessionState,
  OmsCompleteAuthResult,
  OmsCredentialInfo,
  OmsListAccessResponse,
  OmsOidcRedirectAuthResult,
  OmsSendTransactionResponse,
  OmsStartOidcRedirectAuthResult,
  OmsTransactionHistoryResult,
  OmsTransactionStatus,
  WalletAccount,
  OmsWalletActivationResult,
  SendTransactionParams,
  SignMessageParams,
  SignInWithOidcIdTokenParams,
  SignTypedDataParams,
  StartOidcRedirectAuthParams,
  IsValidMessageSignatureParams,
  IsValidTypedDataSignatureParams,
} from './types';

function unsupported(): never {
  throw new Error(
    "'@0xsequence/oms-react-native-sdk' is only supported on native platforms."
  );
}

export class OMSWallet {
  public readonly wallet: OMSWalletClient;
  public readonly indexer: OMSIndexerClient;

  constructor(_config: OMSWalletParams) {
    this.wallet = new OMSWalletClient();
    this.indexer = new OMSIndexerClient();
  }
}

export class OMSWalletClient {
  getWalletAddress(): Promise<string | null> {
    unsupported();
  }

  getSession(): Promise<OMSWalletSessionState> {
    unsupported();
  }

  onSessionExpired(
    _listener: (event: OMSWalletSessionExpiredEvent) => void
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

  listWallets(): Promise<WalletAccount[]> {
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

  signMessage(_params: SignMessageParams): Promise<string> {
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

  isValidMessageSignature(
    _params: IsValidMessageSignatureParams
  ): Promise<boolean> {
    unsupported();
  }

  isValidTypedDataSignature(
    _params: IsValidTypedDataSignatureParams
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
