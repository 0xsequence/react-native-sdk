// src/SequenceContext.ts
import { createContext, useContext } from 'react';
import { DappClient, type Session } from '@0xsequence/dapp-client';
import { Address } from 'ox';

export interface SequenceContextState {
  // The DappClient instance
  client: DappClient | null;

  // Connection state
  isInitializing: boolean;
  isInitialized: boolean;

  // Session properties
  walletAddress: Address.Address | null;
  sessions: Session[];
  loginMethod: string | null;
  userEmail: string | null;
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
