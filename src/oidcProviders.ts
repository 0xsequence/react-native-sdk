import type { OmsRelayOidcProvider } from './types';

const google = Object.freeze({
  provider: 'google',
}) as OmsRelayOidcProvider;

const apple = Object.freeze({
  provider: 'apple',
}) as OmsRelayOidcProvider;

export const OmsRelayOidcProviders = Object.freeze({ google, apple });

export function isOmsRelayOidcProvider(
  provider: unknown
): provider is OmsRelayOidcProvider {
  return provider === google || provider === apple;
}
