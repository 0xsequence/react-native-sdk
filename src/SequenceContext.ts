// File: src/SequenceContext.ts

import { createContext, useContext } from 'react';
import {
  type Session,
  type Relayer,
  type SignatureSuccessResponse,
  type Transaction,
  type Signers,
  type LoginMethod,
} from '@0xsequence/dapp-client';
import { Address, Hex } from 'ox';
import { type TypedData } from 'ox/TypedData';

export type SendTransactionResult =
  | {
      isFeeRequired: true;
      feeOptions: Relayer.FeeOption[];
      send: (feeOption: Relayer.FeeOption) => Promise<Hex.Hex>;
    }
  | {
      isFeeRequired: false;
      txHash: Hex.Hex;
    };
// --- END CHANGED ---

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
  connect: (options?: {
    permissions?: Signers.Session.ExplicitParams;
    loginMethod?: LoginMethod;
    email?: string;
  }) => Promise<void>;

  disconnect: () => Promise<void>;

  signMessage: (message: string) => Promise<SignatureSuccessResponse>;

  signTypedData: (typedData: TypedData) => Promise<SignatureSuccessResponse>;

  /**
   * Initiates a transaction.
   * If fee options are available, it returns them along with a function to complete the transaction.
   * If no fee options are required, it sends the transaction directly and returns the hash.
   */
  sendTransaction: (
    transactions: Transaction[]
  ) => Promise<SendTransactionResult>;
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
