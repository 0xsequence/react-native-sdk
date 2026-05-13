export type {
  OmsNetwork,
  OmsTokenBalance,
  OmsTokenBalancesPage,
  OmsTokenBalancesResult,
  OmsWallet,
} from './NativeOmsClientReactNativeSdk';

export type OmsClientEnvironment = {
  walletApiUrl?: string;
  apiRpcUrl?: string;
  indexerUrlTemplate?: string;
  scope?: string;
};

export type OmsClientConfig = {
  projectAccessKey: string;
  environment?: OmsClientEnvironment;
};

export type SendTransactionParams = {
  chainId: string;
  to: string;
  value: string;
  data?: string | null;
};

export type GetTokenBalancesParams = {
  chainId: string;
  contractAddress: string;
  walletAddress: string;
  includeMetadata?: boolean;
};

export type VerifyMessageSignatureParams = {
  chainId: string;
  walletAddress: string;
  message: string;
  signature: string;
};
