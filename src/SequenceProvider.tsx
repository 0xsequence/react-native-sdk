// Polyfills
import { polyfillWebCrypto } from 'expo-standard-web-crypto';
import 'react-native-url-polyfill/auto';
polyfillWebCrypto();
// Polyfills end

import { useState, useEffect, useMemo, type ReactNode, type JSX } from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
  DappClient,
  TransportMode,
  type SequenceSessionStorage,
} from '@0xsequence/dapp-client';
import { SequenceContext, type SequenceContextState } from './SequenceContext';
import { Hex } from 'ox';
import { getRandomBytes } from 'expo-crypto';
import { MMKV } from 'react-native-mmkv';
import { ReactNativeStorage } from './storage';

const reactNativeRandomPrivateKey = async (): Promise<Hex.Hex> => {
  const newPkBytes = getRandomBytes(32);
  return Hex.from(newPkBytes);
};

const mmkvStorage = new MMKV();

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

const storage = new ReactNativeStorage();

type SequenceProviderProps = {
  children: ReactNode;
  config: {
    walletUrl: string;
    origin: string;
    projectAccessKey: string;
  };
};

export const SequenceProvider = ({
  children,
  config,
}: SequenceProviderProps): JSX.Element => {
  const [client, setClient] = useState<DappClient | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [contextState, setContextState] = useState<
    Omit<SequenceContextState, 'client' | 'isInitializing'>
  >({
    isInitialized: false,
    walletAddress: null,
    sessions: [],
    loginMethod: null,
    userEmail: null,
  });

  // Instantiate the DappClient once
  useEffect(() => {
    const { walletUrl, origin, projectAccessKey } = config;
    const dappClient = new DappClient(walletUrl, origin, projectAccessKey, {
      transportMode: TransportMode.REDIRECT,
      sequenceStorage: storage,
      sequenceSessionStorage: sequenceSessionStorage,
      randomPrivateKeyFn: reactNativeRandomPrivateKey,
      redirectActionHandler: (url: string) => {
        WebBrowser.openBrowserAsync(url);
      },
      canUseIndexedDb: false,
    });
    setClient(dappClient);
  }, [config]);

  useEffect(() => {
    if (!client) return;

    const initializeClient = async () => {
      try {
        await client.initialize();
      } catch (e) {
        console.error('Failed to initialize DappClient', e);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeClient();

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

    const unsubscribe = client.on('sessionsUpdated', updateState);

    return () => {
      unsubscribe();
    };
  }, [client]);

  const value = useMemo(
    () => ({
      client,
      isInitializing,
      ...contextState,
    }),
    [client, isInitializing, contextState]
  );

  return (
    <SequenceContext.Provider value={value}>
      {children}
    </SequenceContext.Provider>
  );
};
