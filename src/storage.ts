import {
  type ExplicitSessionData,
  type ImplicitSessionData,
  type PendingRequestContext,
  type SequenceStorage,
  type SessionlessConnectionData,
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
const SESSIONLESS_CONNECTION_KEY = 'SequenceSessionlessConnection';
const SESSIONLESS_CONNECTION_SNAPSHOT_KEY =
  'SequenceSessionlessConnectionSnapshot';

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

  async saveSessionlessConnection(
    sessionData: SessionlessConnectionData
  ): Promise<void> {
    await setItem(SESSIONLESS_CONNECTION_KEY, sessionData);
  }

  async getSessionlessConnection(): Promise<SessionlessConnectionData | null> {
    return getItem<SessionlessConnectionData>(SESSIONLESS_CONNECTION_KEY);
  }

  async clearSessionlessConnection(): Promise<void> {
    await deleteItem(SESSIONLESS_CONNECTION_KEY);
  }

  async saveSessionlessConnectionSnapshot(
    sessionData: SessionlessConnectionData
  ): Promise<void> {
    await setItem(SESSIONLESS_CONNECTION_SNAPSHOT_KEY, sessionData);
  }

  async getSessionlessConnectionSnapshot(): Promise<SessionlessConnectionData | null> {
    return getItem<SessionlessConnectionData>(
      SESSIONLESS_CONNECTION_SNAPSHOT_KEY
    );
  }

  async clearSessionlessConnectionSnapshot(): Promise<void> {
    await deleteItem(SESSIONLESS_CONNECTION_SNAPSHOT_KEY);
  }

  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        deleteItem(PENDING_REDIRECT_REQUEST_KEY),
        deleteItem(TEMP_SESSION_PK_KEY),
        deleteItem(PENDING_REQUEST_CONTEXT_KEY),
        deleteItem(EXPLICIT_SESSIONS_KEY),
        deleteItem(IMPLICIT_SESSIONS_KEY),
        deleteItem(SESSIONLESS_CONNECTION_KEY),
        deleteItem(SESSIONLESS_CONNECTION_SNAPSHOT_KEY),
      ]);
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }
}
