import { useCallback } from 'react';
import {
  RequestActionType,
  type DappClient,
  type LoginMethod,
  type Relayer,
  type SendWalletTransactionSuccessResponse,
  type SignatureSuccessResponse,
  type Transaction,
  type Signers,
} from '@0xsequence/dapp-client';
import type { TypedData } from 'ox/TypedData';

import type { SendTransactionResult } from './SequenceContext';

const ACTION_TIMEOUT_MS = 120000; // 2 minutes for wallet actions

/**
 * Defines the function type for the promisify helper to avoid TSX parsing issues.
 */
type PromisifyFn = <T>(
  actionType: any,
  performer: () => Promise<any>
) => Promise<T>;

/**
 * A hook that encapsulates all wallet actions and event handling logic.
 * @param client The DappClient instance.
 * @param chainId The currently active chain ID.
 * @returns An object with memoized functions for wallet interactions.
 */
export const useSequenceEvents = (client: DappClient, chainId: number) => {
  const promisifyWalletAction: PromisifyFn = useCallback(
    (actionType, performer) => {
      if (!client.isInitialized) {
        return Promise.reject(new Error('Sequence client not initialized.'));
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          unsubscribe();
          reject(
            new Error(`Request timed out after ${ACTION_TIMEOUT_MS / 1000}s.`)
          );
        }, ACTION_TIMEOUT_MS);

        const unsubscribe = client.on('walletActionResponse', (data) => {
          if (data.action === actionType && data.chainId === chainId) {
            clearTimeout(timeout);
            unsubscribe();
            if (data.error) {
              reject(new Error(JSON.stringify(data.error)));
            } else {
              resolve(data.response as any);
            }
          }
        });

        performer().catch((err) => {
          clearTimeout(timeout);
          unsubscribe();
          reject(err);
        });
      });
    },
    [client, chainId]
  );

  const connect = useCallback(
    async (options?: {
      permissions?: Signers.Session.ExplicitParams;
      loginMethod?: LoginMethod;
      email?: string;
    }) => {
      if (client.isInitialized) {
        throw new Error('A session already exists. Disconnect first.');
      }
      // The connect method dispatches a redirect, and the app's state will
      // be updated automatically when it re-initializes upon return.
      await client.connect(chainId, options?.permissions, {
        preferredLoginMethod: options?.loginMethod,
        email: options?.email,
        // includeImplicitSession: true,
      });
    },
    [client, chainId]
  );

  const disconnect = useCallback(async () => {
    return client.disconnect();
  }, [client]);

  const signMessage = useCallback(
    async (message: string): Promise<SignatureSuccessResponse> => {
      return promisifyWalletAction<SignatureSuccessResponse>(
        RequestActionType.SIGN_MESSAGE,
        () => client.signMessage(chainId, message)
      );
    },
    [client, chainId, promisifyWalletAction]
  );

  const signTypedData = useCallback(
    async (typedData: TypedData): Promise<SignatureSuccessResponse> => {
      return promisifyWalletAction<SignatureSuccessResponse>(
        RequestActionType.SIGN_TYPED_DATA,
        () => client.signTypedData(chainId, typedData)
      );
    },
    [client, chainId, promisifyWalletAction]
  );

  const sendTransaction = useCallback(
    async (transactions: Transaction[]): Promise<SendTransactionResult> => {
      if (!client.isInitialized) {
        throw new Error('Sequence client not initialized.');
      }

      let hasPerms = false;
      try {
        hasPerms = await client.hasPermission(chainId, transactions);
      } catch (e) {
        console.error('Error checking permissions:', e);
      }

      if (!hasPerms) {
        console.info(
          `Session does not have permission for this transaction. Sending to wallet for approval.`
        );

        if (transactions.length > 1) {
          throw new Error(
            'Batch transactions are not supported when wallet approval is required.'
          );
        }

        const txn = transactions[0];
        if (!txn) {
          throw new Error('No transaction provided.');
        }

        const response =
          await promisifyWalletAction<SendWalletTransactionSuccessResponse>(
            RequestActionType.SEND_WALLET_TRANSACTION,
            () => client.sendWalletTransaction(chainId, txn)
          );

        return { isFeeRequired: false, txHash: response.transactionHash };
      }

      try {
        const feeOptions = await client.getFeeOptions(chainId, transactions);

        if (feeOptions && feeOptions.length > 0) {
          return {
            isFeeRequired: true,
            feeOptions,
            send: (feeOption: Relayer.FeeOption) =>
              client.sendTransaction(chainId, transactions, feeOption),
          };
        } else {
          const txHash = await client.sendTransaction(chainId, transactions);
          return { isFeeRequired: false, txHash };
        }
      } catch (e) {
        console.error('Error getting fee options:', e);
        throw new Error(
          `Failed to get fee options: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    },
    [client, chainId, promisifyWalletAction]
  );

  return {
    connect,
    disconnect,
    signMessage,
    signTypedData,
    sendTransaction,
  };
};
