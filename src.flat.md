# Contents of src source tree

## File: index.tsx

```tsx
export {
  SequenceProvider,
  type SequenceProviderConfig,
} from './SequenceProvider';
export { SequenceContext, useSequence } from './SequenceContext';

```

## File: helpers.ts

```typescript
import { useEffect, useState } from 'react';
import { mmkvStorage } from './setup';

export function useLocalState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const jsonValue = mmkvStorage.getString(key);
      return jsonValue !== undefined ? JSON.parse(jsonValue) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      mmkvStorage.set(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to save state to MMKV for key "${key}"`, e);
    }
  }, [key, value]);

  return [value, setValue];
}

```

## File: storage.ts

```typescript
import {
  type ExplicitSessionData,
  type ImplicitSessionData,
  type PendingRequestContext,
  type SequenceStorage,
  jsonReplacers,
  jsonRevivers,
} from '@0xsequence/dapp-client';
import * as SecureStore from 'expo-secure-store';
import { Address, Hex } from 'ox';

// --- Key Definitions ---
const IMPLICIT_SESSIONS_KEY = 'SequenceImplicitSession';
const EXPLICIT_SESSIONS_KEY = 'SequenceExplicitSession';
const PENDING_REDIRECT_REQUEST_KEY = 'SequencePendingRedirect';
const TEMP_SESSION_PK_KEY = 'SequencePendingTempSessionPk';
const PENDING_REQUEST_CONTEXT_KEY = 'SequencePendingRequestContext';

// --- SecureStore Helper Functions ---
const getItem = async <T>(key: string): Promise<T | null> => {
  try {
    const jsonValue = await SecureStore.getItemAsync(key);
    if (jsonValue === null) {
      return null;
    }
    return JSON.parse(jsonValue, jsonRevivers) as T;
  } catch (error) {
    console.error(`Failed to get item "${key}" from SecureStore`, error);
    // Attempt to clear corrupted item
    await SecureStore.deleteItemAsync(key).catch(() => {});
    return null;
  }
};

const setItem = async (key: string, value: unknown): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(value, jsonReplacers);
    await SecureStore.setItemAsync(key, jsonValue);
  } catch (error) {
    console.error(`Failed to set item "${key}" in SecureStore`, error);
  }
};

const deleteItem = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error(`Failed to delete item "${key}" from SecureStore`, error);
  }
};

// --- React Native Storage Implementation ---
export class ReactNativeStorage implements SequenceStorage {
  async setPendingRedirectRequest(isPending: boolean): Promise<void> {
    if (isPending) {
      await setItem(PENDING_REDIRECT_REQUEST_KEY, 'true');
    } else {
      await deleteItem(PENDING_REDIRECT_REQUEST_KEY);
    }
  }

  async isRedirectRequestPending(): Promise<boolean> {
    const value = await getItem<string>(PENDING_REDIRECT_REQUEST_KEY);
    return value === 'true';
  }

  async saveTempSessionPk(pk: Hex.Hex): Promise<void> {
    await setItem(TEMP_SESSION_PK_KEY, pk);
  }

  async getAndClearTempSessionPk(): Promise<Hex.Hex | null> {
    const pk = await getItem<Hex.Hex>(TEMP_SESSION_PK_KEY);
    if (pk) {
      await deleteItem(TEMP_SESSION_PK_KEY);
    }
    return pk;
  }

  async savePendingRequest(context: PendingRequestContext): Promise<void> {
    await setItem(PENDING_REQUEST_CONTEXT_KEY, context);
  }

  async getAndClearPendingRequest(): Promise<PendingRequestContext | null> {
    const context = await getItem<PendingRequestContext>(
      PENDING_REQUEST_CONTEXT_KEY
    );
    if (context) {
      await deleteItem(PENDING_REQUEST_CONTEXT_KEY);
    }
    return context;
  }

  async peekPendingRequest(): Promise<PendingRequestContext | null> {
    return getItem<PendingRequestContext>(PENDING_REQUEST_CONTEXT_KEY);
  }

  async saveExplicitSession(sessionData: ExplicitSessionData): Promise<void> {
    const existingSessions = await this.getExplicitSessions();
    const filteredSessions = existingSessions.filter(
      (s) =>
        !(
          Address.isEqual(s.walletAddress, sessionData.walletAddress) &&
          s.pk === sessionData.pk &&
          s.chainId === sessionData.chainId
        )
    );
    await setItem(EXPLICIT_SESSIONS_KEY, [...filteredSessions, sessionData]);
  }

  async getExplicitSessions(): Promise<ExplicitSessionData[]> {
    const sessions = await getItem<ExplicitSessionData[]>(
      EXPLICIT_SESSIONS_KEY
    );
    return Array.isArray(sessions) ? sessions : [];
  }

  async clearExplicitSessions(): Promise<void> {
    await deleteItem(EXPLICIT_SESSIONS_KEY);
  }

  async saveImplicitSession(sessionData: ImplicitSessionData): Promise<void> {
    await setItem(IMPLICIT_SESSIONS_KEY, sessionData);
  }

  async getImplicitSession(): Promise<ImplicitSessionData | null> {
    return getItem<ImplicitSessionData>(IMPLICIT_SESSIONS_KEY);
  }

  async clearImplicitSession(): Promise<void> {
    await deleteItem(IMPLICIT_SESSIONS_KEY);
  }

  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        deleteItem(PENDING_REDIRECT_REQUEST_KEY),
        deleteItem(TEMP_SESSION_PK_KEY),
        deleteItem(PENDING_REQUEST_CONTEXT_KEY),
        deleteItem(EXPLICIT_SESSIONS_KEY),
        deleteItem(IMPLICIT_SESSIONS_KEY),
      ]);
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }
}

```

## File: setup.ts

```typescript
// Polyfills
import { polyfillWebCrypto } from 'expo-standard-web-crypto';
import 'react-native-url-polyfill/auto';
polyfillWebCrypto();
// Polyfills end

import { Hex } from 'ox';
import { getRandomBytes } from 'expo-crypto';
import { MMKV } from 'react-native-mmkv';
import * as WebBrowser from 'expo-web-browser';

import { ReactNativeStorage } from './storage';
import {
  DappClient,
  TransportMode,
  type SequenceSessionStorage,
} from '@0xsequence/dapp-client';

const reactNativeRandomPrivateKey = async (): Promise<Hex.Hex> => {
  const newPkBytes = getRandomBytes(32);
  return Hex.from(newPkBytes);
};

export const mmkvStorage = new MMKV();

export const sequenceSessionStorage: SequenceSessionStorage = {
  getItem: (key: string): string | null => {
    const value = mmkvStorage.getString(key);
    return value === undefined ? null : value;
  },

  setItem: (key: string, value: string): void => {
    mmkvStorage.set(key, value);
  },

  removeItem: (key: string): void => {
    mmkvStorage.delete(key);
  },
};

export const storage = new ReactNativeStorage();

export type SequenceProviderConfig = {
  walletUrl: string;
  origin: string;
  projectAccessKey: string;
  defaultChainId: number;
};

let dappClientInstance: DappClient | null = null;

export const getDappClient = (config: SequenceProviderConfig): DappClient => {
  if (!dappClientInstance) {
    dappClientInstance = new DappClient(
      config.walletUrl,
      config.origin,
      config.projectAccessKey,
      {
        transportMode: TransportMode.REDIRECT,
        sequenceStorage: storage,
        sequenceSessionStorage: sequenceSessionStorage,
        randomPrivateKeyFn: reactNativeRandomPrivateKey,
        redirectActionHandler: (url: string) => {
          WebBrowser.openBrowserAsync(url);
        },
        canUseIndexedDb: false,
      }
    );
  }
  return dappClientInstance;
};

```

## File: SequenceProvider.tsx

```tsx
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
  type Relayer,
  type SendWalletTransactionSuccessResponse,
  type SignatureSuccessResponse,
  type Transaction,
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
        // Session has permissions, send directly
        return client.sendTransaction(chainId, transactions, feeOption);
      } else {
        // Session needs user approval from wallet
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

```

## File: SequenceContext.ts

```typescript
import { createContext, useContext } from 'react';
import {
  type Session,
  type Relayer,
  type SignatureSuccessResponse,
  type Transaction,
} from '@0xsequence/dapp-client';
import { Address, Hex } from 'ox';
import { type TypedData } from 'ox/TypedData';

export interface SequenceContextState {
  // Connection state
  isInitializing: boolean;
  isInitialized: boolean;

  // Session properties
  walletAddress: Address.Address | null;
  sessions: Session[];
  loginMethod: string | null;
  userEmail: string | null;

  // Chain state
  chainId: number;
  setChainId: (chainId: number) => void;

  // Wrapped DappClient methods
  disconnect: () => Promise<void>;

  signMessage: (message: string) => Promise<SignatureSuccessResponse>;

  signTypedData: (typedData: TypedData) => Promise<SignatureSuccessResponse>;

  sendTransaction: (
    transactions: Transaction[],
    feeOption?: Relayer.FeeOption
  ) => Promise<Hex.Hex>;
}

// Create the context with a default undefined value
export const SequenceContext = createContext<SequenceContextState | undefined>(
  undefined
);

/**
 * Custom hook to access the Sequence context.
 * Throws an error if used outside of a SequenceProvider.
 *
 * @returns {SequenceContextState} The context state.
 */
export const useSequence = (): SequenceContextState => {
  const context = useContext(SequenceContext);
  if (context === undefined) {
    throw new Error('useSequence must be used within a SequenceProvider');
  }
  return context;
};

```

## File: __tests__/index.test.tsx

```tsx
it.todo('write a test');

```

