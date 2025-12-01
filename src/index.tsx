export { SequenceProvider } from './SequenceProvider';
export { type SequenceProviderConfig } from './setup';

export {
  SequenceContext,
  useSequence,
  type SendTransactionResult,
} from './SequenceContext';

// Re-export all necessary types from the core dapp-client and other libraries.
// This prevents type duplication and provides a clean, single point of import for SDK consumers.
export {
  getExplorerUrl,
  Signers,
  Utils,
  type LoginMethod,
  type Session,
  type SignatureResponse,
  type Transaction,
  type SessionResponse,
} from '@0xsequence/dapp-client';

export type { Relayer } from '@0xsequence/relayer';

export type { TypedData } from 'ox/TypedData';
