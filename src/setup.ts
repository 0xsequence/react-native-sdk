// Polyfills
import { polyfillWebCrypto } from 'expo-standard-web-crypto';
import 'react-native-url-polyfill/auto';
polyfillWebCrypto();
// Polyfills end

import { Hex } from 'ox';
import { getRandomBytes } from 'expo-crypto';
import { createMMKV } from 'react-native-mmkv';
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

export const mmkvStorage = createMMKV();

export const sequenceSessionStorage: SequenceSessionStorage = {
  getItem: (key: string): string | null => {
    const value = mmkvStorage.getString(key);
    return value === undefined ? null : value;
  },

  setItem: (key: string, value: string): void => {
    mmkvStorage.set(key, value);
  },

  removeItem: (key: string): void => {
    mmkvStorage.remove(key);
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
