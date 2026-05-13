import OmsClientReactNativeSdk from './NativeOmsClientReactNativeSdk';
import type {
  GetTokenBalancesParams,
  OmsClientConfig,
  OmsNetwork,
  OmsTokenBalancesResult,
  OmsWallet,
  SendTransactionParams,
  VerifyMessageSignatureParams,
} from './types';

export function configure(config: OmsClientConfig): Promise<void> {
  return OmsClientReactNativeSdk.configure(
    config.projectAccessKey,
    config.environment?.walletApiUrl ?? null,
    config.environment?.apiRpcUrl ?? null,
    config.environment?.indexerUrlTemplate ?? null,
    config.environment?.scope ?? null
  );
}

export function getWalletAddress(): Promise<string | null> {
  return OmsClientReactNativeSdk.getWalletAddress();
}

export function getSupportedNetworks(): Promise<OmsNetwork[]> {
  return OmsClientReactNativeSdk.getSupportedNetworks();
}

export function startEmailAuth(email: string): Promise<void> {
  return OmsClientReactNativeSdk.startEmailAuth(email);
}

export function completeEmailAuth(code: string): Promise<OmsWallet> {
  return OmsClientReactNativeSdk.completeEmailAuth(code);
}

export function signOut(): Promise<void> {
  return OmsClientReactNativeSdk.signOut();
}

export function signMessage(chainId: string, message: string): Promise<string> {
  return OmsClientReactNativeSdk.signMessage(chainId, message);
}

export function sendTransaction(
  params: SendTransactionParams
): Promise<string> {
  return OmsClientReactNativeSdk.sendTransaction(
    params.chainId,
    params.to,
    params.value,
    params.data ?? null
  );
}

export function getTokenBalances(
  params: GetTokenBalancesParams
): Promise<OmsTokenBalancesResult> {
  return OmsClientReactNativeSdk.getTokenBalances(
    params.chainId,
    params.contractAddress,
    params.walletAddress,
    params.includeMetadata ?? false
  );
}

export function verifyMessageSignature(
  params: VerifyMessageSignatureParams
): Promise<boolean> {
  return OmsClientReactNativeSdk.verifyMessageSignature(
    params.chainId,
    params.walletAddress,
    params.message,
    params.signature
  );
}
