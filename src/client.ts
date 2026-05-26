import type {
  CallContractParams,
  CompleteEmailAuthParams,
  CreateWalletParams,
  HandleOidcRedirectCallbackParams,
  GetIdTokenParams,
  GetNativeTokenBalanceParams,
  GetTokenBalancesParams,
  ListAccessPageParams,
  ListAccessPagesParams,
  ListAccessParams,
  OmsClientConfig,
  OmsClientSessionState,
  OmsCompleteAuthResult,
  OmsCredentialInfo,
  OmsListAccessResponse,
  OmsNetwork,
  OmsOidcRedirectAuthResult,
  OmsSendTransactionResponse,
  OmsStartOidcRedirectAuthResult,
  OmsTokenBalance,
  OmsTokenBalancesResult,
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
    "'oms-client-react-native-sdk' is only supported on native platforms."
  );
}

export function configure(_config: OmsClientConfig): Promise<void> {
  unsupported();
}

export function getWalletAddress(): Promise<string | null> {
  unsupported();
}

export function getSession(): Promise<OmsClientSessionState> {
  unsupported();
}

export function getSupportedNetworks(): Promise<OmsNetwork[]> {
  unsupported();
}

export function startEmailAuth(_email: string): Promise<void> {
  unsupported();
}

export function completeEmailAuth(
  _params: CompleteEmailAuthParams
): Promise<OmsCompleteAuthResult> {
  unsupported();
}

export function signInWithOidcIdToken(
  _params: SignInWithOidcIdTokenParams
): Promise<OmsCompleteAuthResult> {
  unsupported();
}

export function startOidcRedirectAuth(
  _params: StartOidcRedirectAuthParams
): Promise<OmsStartOidcRedirectAuthResult> {
  unsupported();
}

export function handleOidcRedirectCallback(
  _params: HandleOidcRedirectCallbackParams = {}
): Promise<OmsOidcRedirectAuthResult> {
  unsupported();
}

export function listWallets(): Promise<OmsWallet[]> {
  unsupported();
}

export function useWallet(
  _walletId: string
): Promise<OmsWalletActivationResult> {
  unsupported();
}

export function createWallet(
  _params: CreateWalletParams = {}
): Promise<OmsWalletActivationResult> {
  unsupported();
}

export function signOut(): Promise<void> {
  unsupported();
}

export function signMessage(
  _chainId: string,
  _message: string
): Promise<string> {
  unsupported();
}

export function signTypedData(_params: SignTypedDataParams): Promise<string> {
  unsupported();
}

export function sendTransaction(
  _params: SendTransactionParams
): Promise<OmsSendTransactionResponse> {
  unsupported();
}

export function callContract(
  _params: CallContractParams
): Promise<OmsSendTransactionResponse> {
  unsupported();
}

export function getTransactionStatus(
  _txnId: string
): Promise<OmsTransactionStatus> {
  unsupported();
}

export function getTokenBalances(
  _params: GetTokenBalancesParams
): Promise<OmsTokenBalancesResult> {
  unsupported();
}

export function getNativeTokenBalance(
  _params: GetNativeTokenBalanceParams
): Promise<OmsTokenBalance | null> {
  unsupported();
}

export function verifyMessageSignature(
  _params: VerifyMessageSignatureParams
): Promise<boolean> {
  unsupported();
}

export function verifyTypedDataSignature(
  _params: VerifyTypedDataSignatureParams
): Promise<boolean> {
  unsupported();
}

export function getIdToken(_params: GetIdTokenParams = {}): Promise<string> {
  unsupported();
}

export function listAccess(
  _params: ListAccessParams = {}
): Promise<OmsCredentialInfo[]> {
  unsupported();
}

export async function* listAccessPages(
  _params: ListAccessPagesParams = {}
): AsyncGenerator<OmsListAccessResponse, void, void> {
  unsupported();
}

export function listAccessPage(
  _params: ListAccessPageParams = {}
): Promise<OmsListAccessResponse> {
  unsupported();
}

export function revokeAccess(_targetCredentialId: string): Promise<void> {
  unsupported();
}
