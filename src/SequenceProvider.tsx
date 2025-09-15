import { useState, useEffect, useMemo, type ReactNode, type JSX } from 'react';
import { useLinkingURL } from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { SequenceContext, type SequenceContextState } from './SequenceContext';
import { getDappClient, storage, type SequenceProviderConfig } from './setup';
import { useLocalState } from './helpers';
import { useSequenceEvents } from './hooks';

type SequenceProviderProps = {
  children: ReactNode;
  config: SequenceProviderConfig;
};

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

  // The event handlers are now managed in the useSequenceEvents hook
  const sequenceEvents = useSequenceEvents(client, chainId);

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
      try {
        const pendingRequest = await storage.isRedirectRequestPending();

        if (pendingRequest && url) {
          await client.handleRedirectResponse(url);
          await storage.setPendingRedirectRequest(false);
          await WebBrowser.dismissBrowser();
        }
        await client.initialize();
      } catch (e) {
        console.error('Failed to initialize DappClient', e);
      } finally {
        updateState();
        setIsInitializing(false);
      }
    };

    initializeClient();

    const unsubscribe = client.on('sessionsUpdated', updateState);

    // After a successful connection, the client will emit 'sessionsUpdated',
    // which will trigger the updateState function to refresh the context.
    client.on('sessionsUpdated', updateState);

    return () => {
      unsubscribe();
    };
  }, [url, client]);

  const value = useMemo(
    () => ({
      isInitializing,
      chainId,
      setChainId,
      ...sequenceEvents,
      ...contextState,
    }),
    [isInitializing, chainId, setChainId, sequenceEvents, contextState]
  );

  return (
    <SequenceContext.Provider value={value}>
      {children}
    </SequenceContext.Provider>
  );
};
