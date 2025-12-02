import { useCallback } from 'react';
import {
  RequestActionType,
  type DappClient,
  type LoginMethod,
  type SendWalletTransactionResponse,
  type SignatureResponse,
  type Transaction,
  type SessionResponse,
  type ExplicitSessionConfig,
} from '@0xsequence/dapp-client';
import type { Relayer } from '@0xsequence/relayer';
import type { TypedData } from 'ox/TypedData';

import type { SendTransactionResult } from './SequenceContext';

const ACTION_TIMEOUT_MS = 120000; // 2 minutes for wallet actions

/**
 * A hook that encapsulates all wallet actions and event handling logic.
 * @param client The DappClient instance.
 * @param chainId The currently active chain ID.
 * @returns An object with memoized functions for wallet interactions.
 */
export const useSequenceEvents = (client: DappClient, chainId: number) => {
  const promisifyWalletAction = useCallback(
    <R>(actionType: any, performer: () => Promise<any>): Promise<R> => {
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
              resolve(data.response as R);
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

  const promisifySessionAction = useCallback(
    <R>(actionType: any, performer: () => Promise<any>): Promise<R> => {
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

        const unsubscribe = client.on('explicitSessionResponse', (data) => {
          if (data.action === actionType && data.chainId === chainId) {
            clearTimeout(timeout);
            unsubscribe();
            if (data.error) {
              reject(new Error(JSON.stringify(data.error)));
            } else {
              resolve(data.response as R);
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
      explicitSession?: ExplicitSessionConfig;
      loginMethod?: LoginMethod;
      email?: string;
    }) => {
      if (client.isInitialized) {
        throw new Error('A session already exists. Disconnect first.');
      }
      // The connect method dispatches a redirect, and the app's state will
      // be updated automatically when it re-initializes upon return.
      await client.connect(chainId, options?.explicitSession, {
        preferredLoginMethod: options?.loginMethod,
        email: options?.email,
        includeImplicitSession: true,
      });
    },
    [client, chainId]
  );

  const disconnect = useCallback(async () => {
    return client.disconnect();
  }, [client]);

  const signMessage = useCallback(
    async (message: string): Promise<SignatureResponse> => {
      return promisifyWalletAction<SignatureResponse>(
        RequestActionType.SIGN_MESSAGE,
        () => client.signMessage(chainId, message)
      );
    },
    [client, chainId, promisifyWalletAction]
  );

  const signTypedData = useCallback(
    async (typedData: TypedData): Promise<SignatureResponse> => {
      return promisifyWalletAction<SignatureResponse>(
        RequestActionType.SIGN_TYPED_DATA,
        () => client.signTypedData(chainId, typedData)
      );
    },
    [client, chainId, promisifyWalletAction]
  );

  const hasPermission = useCallback(
    async (transactions: Transaction[]): Promise<boolean> => {
      if (!client.isInitialized) {
        return false;
      }
      try {
        return await client.hasPermission(chainId, transactions);
      } catch (e) {
        console.error('Error checking permissions:', e);
        return false;
      }
    },
    [client, chainId]
  );

  const addExplicitSession = useCallback(
    async (
      explicitSessionConfig: ExplicitSessionConfig
    ): Promise<SessionResponse> => {
      return promisifySessionAction<SessionResponse>(
        RequestActionType.ADD_EXPLICIT_SESSION,
        () => client.addExplicitSession(explicitSessionConfig)
      );
    },
    [client, promisifySessionAction]
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
          await promisifyWalletAction<SendWalletTransactionResponse>(
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
          `Failed to get fee options: ${
            e instanceof Error ? e.message : String(e)
          }`
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
    hasPermission,
    addExplicitSession,
  };
};
