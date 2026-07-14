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
  BalancesResult,
  OMSWalletParams,
  OMSWalletSessionExpiredEvent,
  OMSWalletSessionState,
  CompleteAuthResult,
  CredentialInfo,
  ListAccessResponse,
  OidcRedirectAuthResult,
  SendTransactionResponse,
  StartOidcRedirectAuthResult,
  TransactionHistoryResult,
  TransactionStatusResponse,
  WalletAccount,
  WalletActivationResult,
  SendTransactionParams,
  SignMessageParams,
  SignInWithOidcIdTokenParams,
  SignTypedDataParams,
  StartEmailAuthParams,
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

  startEmailAuth(_params: StartEmailAuthParams): Promise<void> {
    unsupported();
  }

  completeEmailAuth(
    _params: CompleteEmailAuthParams
  ): Promise<CompleteAuthResult> {
    unsupported();
  }

  signInWithOidcIdToken(
    _params: SignInWithOidcIdTokenParams
  ): Promise<CompleteAuthResult> {
    unsupported();
  }

  startOidcRedirectAuth(
    _params: StartOidcRedirectAuthParams
  ): Promise<StartOidcRedirectAuthResult> {
    unsupported();
  }

  handleOidcRedirectCallback(
    _params: HandleOidcRedirectCallbackParams
  ): Promise<OidcRedirectAuthResult> {
    unsupported();
  }

  listWallets(): Promise<WalletAccount[]> {
    unsupported();
  }

  useWallet(_walletId: string): Promise<WalletActivationResult> {
    unsupported();
  }

  createWallet(
    _params: CreateWalletParams = {}
  ): Promise<WalletActivationResult> {
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
  ): Promise<SendTransactionResponse> {
    unsupported();
  }

  callContract(_params: CallContractParams): Promise<SendTransactionResponse> {
    unsupported();
  }

  getTransactionStatus(_txnId: string): Promise<TransactionStatusResponse> {
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

  listAccess(_params: ListAccessParams = {}): Promise<CredentialInfo[]> {
    unsupported();
  }

  async *listAccessPages(
    _params: ListAccessPagesParams = {}
  ): AsyncGenerator<ListAccessResponse, void, void> {
    unsupported();
  }

  listAccessPage(
    _params: ListAccessPageParams = {}
  ): Promise<ListAccessResponse> {
    unsupported();
  }

  revokeAccess(_targetCredentialId: string): Promise<void> {
    unsupported();
  }
}

export class OMSIndexerClient {
  getBalances(_params: GetBalancesParams): Promise<BalancesResult> {
    unsupported();
  }

  getTransactionHistory(
    _params: GetTransactionHistoryParams
  ): Promise<TransactionHistoryResult> {
    unsupported();
  }
}
