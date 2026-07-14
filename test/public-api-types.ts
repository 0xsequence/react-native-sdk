import type {
  FeeOptionSelector,
  FeeToken,
  GetBalancesParams,
  OMSWalletSessionState,
  SendTransactionParams,
  SendTransactionResponse,
  StartEmailAuthParams,
  TokenBalance,
  Transaction,
  WalletAccount,
} from '../src/types';
import type { OMSWalletError, OMSWalletUpstreamError } from '../src/errors';

type Assert<T extends true> = T;
type IsOptional<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;
type ExcludesNull<T> = null extends T ? false : true;

export type PublicInputsExcludeNull = Assert<
  ExcludesNull<StartEmailAuthParams['sessionLifetimeSeconds']> &
    ExcludesNull<SendTransactionParams['data']> &
    ExcludesNull<GetBalancesParams['omitPrices']>
>;

export type PublicOutputsExcludeNull = Assert<
  ExcludesNull<OMSWalletSessionState['walletAddress']> &
    ExcludesNull<WalletAccount['reference']> &
    ExcludesNull<SendTransactionResponse['txnHash']> &
    ExcludesNull<TokenBalance['contractAddress']> &
    ExcludesNull<Awaited<ReturnType<FeeOptionSelector>>>
>;

export type OptionalOutputFieldsRemainOptional = Assert<
  IsOptional<WalletAccount, 'reference'> &
    IsOptional<FeeToken, 'decimals'> &
    IsOptional<TokenBalance, 'contractAddress'> &
    IsOptional<SendTransactionResponse, 'txnHash'>
>;

export type RequiredTransactionFieldsRemainRequired = Assert<
  IsOptional<Transaction, 'txnHash'> extends false ? true : false
>;

export type PublicErrorsExcludeNull = Assert<
  ExcludesNull<OMSWalletError['operation']> &
    ExcludesNull<OMSWalletUpstreamError['message']>
>;
