import type { GoogleOidcProviderParams, OidcProviderConfig } from './types';

const DEFAULT_GOOGLE_CLIENT_ID =
  '970987756660-0dh5gubqfiugm452raf7mm39qaq639hn.apps.googleusercontent.com';
const DEFAULT_RELAY_REDIRECT_URI =
  'https://waas-cf-relay-staging.0xsequence.workers.dev/callback';
const DEFAULT_SCOPES = ['openid', 'email', 'profile'];
const DEFAULT_GOOGLE_AUTHORIZE_PARAMS = {
  access_type: 'offline',
  prompt: 'consent',
};

export const OidcProviders = {
  defaultGoogleClientId: DEFAULT_GOOGLE_CLIENT_ID,
  defaultRelayRedirectUri: DEFAULT_RELAY_REDIRECT_URI,

  google(params: GoogleOidcProviderParams = {}): OidcProviderConfig {
    return {
      issuer: 'https://accounts.google.com',
      clientId: params.clientId ?? DEFAULT_GOOGLE_CLIENT_ID,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      scopes: params.scopes ?? DEFAULT_SCOPES,
      relayRedirectUri:
        params.relayRedirectUri === undefined
          ? DEFAULT_RELAY_REDIRECT_URI
          : params.relayRedirectUri,
      authorizeParams: {
        ...DEFAULT_GOOGLE_AUTHORIZE_PARAMS,
        ...params.authorizeParams,
      },
    };
  },
} as const;
