import type {
  GetTokenBalancesParams,
  OmsClientConfig,
  OmsSendTransactionResult,
  OmsClientSessionState,
  OmsNetwork,
  OmsTokenBalancesResult,
  OmsWallet,
  SendTransactionParams,
  VerifyMessageSignatureParams,
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

export function completeEmailAuth(_code: string): Promise<OmsWallet> {
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

export function sendTransaction(
  _params: SendTransactionParams
): Promise<OmsSendTransactionResult> {
  unsupported();
}

export function getTokenBalances(
  _params: GetTokenBalancesParams
): Promise<OmsTokenBalancesResult> {
  unsupported();
}

export function verifyMessageSignature(
  _params: VerifyMessageSignatureParams
): Promise<boolean> {
  unsupported();
}
