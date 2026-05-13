import { TurboModuleRegistry, type TurboModule } from 'react-native';

export type OmsNetwork = {
  chainId: string;
  displayName: string;
};

export type OmsWallet = {
  id: string;
  address: string;
};

export type OmsTokenBalancesPage = {
  page: number;
  pageSize: number;
  more: boolean;
};

export type OmsTokenBalance = {
  contractType?: string;
  contractAddress?: string;
  accountAddress?: string;
  tokenId?: string;
  balance?: string;
  blockHash?: string;
  blockNumber?: number;
  chainId?: number;
};

export type OmsTokenBalancesResult = {
  status: number;
  page?: OmsTokenBalancesPage;
  balances: OmsTokenBalance[];
};

export interface Spec extends TurboModule {
  configure(
    projectAccessKey: string,
    walletApiUrl: string | null,
    apiRpcUrl: string | null,
    indexerUrlTemplate: string | null,
    scope: string | null
  ): Promise<void>;
  getWalletAddress(): Promise<string | null>;
  getSupportedNetworks(): Promise<OmsNetwork[]>;
  startEmailAuth(email: string): Promise<void>;
  completeEmailAuth(code: string): Promise<OmsWallet>;
  signOut(): Promise<void>;
  signMessage(chainId: string, message: string): Promise<string>;
  sendTransaction(
    chainId: string,
    to: string,
    value: string,
    data: string | null
  ): Promise<string>;
  getTokenBalances(
    chainId: string,
    contractAddress: string,
    walletAddress: string,
    includeMetadata: boolean
  ): Promise<OmsTokenBalancesResult>;
  verifyMessageSignature(
    chainId: string,
    walletAddress: string,
    message: string,
    signature: string
  ): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>(
  'OmsClientReactNativeSdk'
);
