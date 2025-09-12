// File: src/SequenceProvider.tsx

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
  type JSX,
} from 'react';
import { useLinkingURL } from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Hex } from 'ox';
import type { TypedData } from 'ox/TypedData';

import { SequenceContext, type SequenceContextState } from './SequenceContext';
import { getDappClient, storage, type SequenceProviderConfig } from './setup';
import {
  RequestActionType,
  type LoginMethod, // <-- Import from dapp-client
  type Relayer,
  type SendWalletTransactionSuccessResponse,
  type SignatureSuccessResponse,
  type Transaction,
  type Signers,
} from '@0xsequence/dapp-client';
import { useLocalState } from './helpers';

const ACTION_TIMEOUT_MS = 120000; // 2 minutes for wallet actions

type SequenceProviderProps = {
  children: ReactNode;
  config: SequenceProviderConfig;
};

// Define the function type for our promisify helper to avoid TSX parsing issues
type PromisifyFn = <T>(
  actionType: any,
  performer: () => Promise<any>
) => Promise<T>;

export const SequenceProvider = ({
  children,
  config,
}: SequenceProviderProps): JSX.Element => {
  const client = getDappClient(config);
  const [isInitializing, setIsInitializing] = useState(true);

  const [chainId, setChainId] = useLocalState<number>(
    'sequence-chain-id',
    config.defaultChainId
  );

  const [contextState, setContextState] = useState<
    Omit<
      SequenceContextState,
      | 'isInitializing'
      | 'chainId'
      | 'setChainId'
      | 'connect'
      | 'disconnect'
      | 'signMessage'
      | 'signTypedData'
      | 'sendTransaction'
    >
  >({
    isInitialized: false,
    walletAddress: null,
    sessions: [],
    loginMethod: null,
    userEmail: null,
  });

  const url = useLinkingURL();

  useEffect(() => {
    if (!client) return;

    const updateState = () => {
      setContextState({
        isInitialized: client.isInitialized,
        walletAddress: client.getWalletAddress(),
        sessions: client.getAllSessions(),
        loginMethod: client.loginMethod,
        userEmail: client.userEmail,
      });
    };

    const initializeClient = async () => {
      console.log('Initializing DappClient...');
      try {
        const pendingRequest = await storage.isRedirectRequestPending();
        if (pendingRequest && url) {
          console.log('Handling redirect response for URL:', url);
          await client.handleRedirectResponse(url);
          await storage.setPendingRedirectRequest(false);
          await WebBrowser.dismissBrowser();
        }
        await client.initialize();
        console.log('walletaddr', client.getWalletAddress());
      } catch (e) {
        console.error('Failed to initialize DappClient', e);
      } finally {
        updateState();
        setIsInitializing(false);
      }
    };

    initializeClient();

    const unsubscribe = client.on('sessionsUpdated', updateState);

    return () => {
      unsubscribe();
    };
  }, [url, client]);

  const connect = useCallback(
    async (options?: {
      permissions?: Signers.Session.ExplicitParams;
      loginMethod?: LoginMethod;
      email?: string;
    }) => {
      if (client.isInitialized) {
        throw new Error('A session already exists. Disconnect first.');
      }
      try {
        await client.connect(chainId, options?.permissions, {
          preferredLoginMethod: options?.loginMethod,
          email: options?.email,
          includeImplicitSession: true,
        });

        const updateState = () => {
          setContextState({
            isInitialized: client.isInitialized,
            walletAddress: client.getWalletAddress(),
            sessions: client.getAllSessions(),
            loginMethod: client.loginMethod,
            userEmail: client.userEmail,
          });
        };
        updateState();
      } catch (e) {
        console.error('Failed to connect:', e);
        throw e;
      }
    },
    [client, chainId]
  );

  const disconnect = useCallback(async () => {
    return client.disconnect();
  }, [client]);

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
    async (
      transactions: Transaction[],
      feeOption?: Relayer.FeeOption
    ): Promise<Hex.Hex> => {
      if (!client.isInitialized) {
        throw new Error('Sequence client not initialized.');
      }

      const hasPerms = await client.hasPermission(chainId, transactions);

      if (hasPerms) {
        return client.sendTransaction(chainId, transactions, feeOption);
      } else {
        console.warn(
          `Session does not have permission for this transaction. Sending to wallet for approval.`
        );

        if (transactions.length > 1) {
          throw new Error(
            'Batch transactions are not supported when wallet approval is required. Please request permissions first or send a single transaction.'
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

        return response.transactionHash;
      }
    },
    [client, chainId, promisifyWalletAction]
  );

  const value = useMemo(
    () => ({
      isInitializing,
      chainId,
      setChainId,
      connect,
      disconnect,
      signMessage,
      signTypedData,
      sendTransaction,
      ...contextState,
    }),
    [
      isInitializing,
      chainId,
      setChainId,
      connect,
      disconnect,
      signMessage,
      signTypedData,
      sendTransaction,
      contextState,
    ]
  );

  return (
    <SequenceContext.Provider value={value}>
      {children}
    </SequenceContext.Provider>
  );
};
