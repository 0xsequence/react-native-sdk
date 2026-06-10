import type { EventSubscription } from 'react-native';
import OmsClientReactNativeSdk from './NativeOmsClientReactNativeSdk';
import type {
  OmsClientSessionExpiredEvent as OmsNativeClientSessionExpiredEvent,
  OmsFeeOptionSelectionRequest,
  OmsNativeCompleteAuthResult,
  OmsNativeOidcRedirectAuthResult,
  OmsNativePendingWalletSelection,
} from './NativeOmsClientReactNativeSdk';
import type {
  CallContractParams,
  CompleteEmailAuthParams,
  CreateWalletParams,
  HandleOidcRedirectCallbackParams,
  GetIdTokenParams,
  GetNativeTokenBalanceParams,
  GetTokenBalancesParams,
  ListAccessPageParams,
  ListAccessPagesParams,
  ListAccessParams,
  OmsClientConfig,
  OmsClientSessionExpiredEvent,
  OmsClientSessionState,
  OmsCompleteAuthResult,
  OmsCredentialInfo,
  OmsFeeOptionSelector,
  OmsListAccessResponse,
  OmsNetwork,
  OmsOidcRedirectAuthResult,
  OmsPendingWalletSelection,
  OmsSendTransactionResponse,
  OmsStartOidcRedirectAuthResult,
  OmsTokenBalance,
  OmsTokenBalancesResult,
  OmsTransactionStatus,
  OmsWallet,
  OmsWalletActivationResult,
  SendTransactionParams,
  SignInWithOidcIdTokenParams,
  SignTypedDataParams,
  StartOidcRedirectAuthParams,
  VerifyMessageSignatureParams,
  VerifyTypedDataSignatureParams,
} from './types';

function stringifyRequiredJson(value: unknown, name: string): string {
  const json = JSON.stringify(value);
  if (json == null) {
    throw new Error(`${name} must be JSON serializable`);
  }
  return json;
}

function stringifyOptionalJson(
  value: unknown | null | undefined
): string | null {
  if (value == null) {
    return null;
  }
  return stringifyRequiredJson(value, 'value');
}

function stringifyOptionalNumber(
  value: number | null | undefined
): string | null {
  return value == null ? null : String(value);
}

function hasOwnProperty(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function resolveRelayRedirectUri(
  params: StartOidcRedirectAuthParams
): string | null {
  if (hasOwnProperty(params, 'relayRedirectUri')) {
    return params.relayRedirectUri ?? null;
  }
  return params.provider.relayRedirectUri ?? null;
}

function hydratePendingWalletSelection(
  pendingSelection: OmsNativePendingWalletSelection
): OmsPendingWalletSelection {
  return {
    ...pendingSelection,
    walletType:
      pendingSelection.walletType as OmsPendingWalletSelection['walletType'],
    selectWallet(walletId: string) {
      return OmsClientReactNativeSdk.selectWalletForPendingSelection(
        pendingSelection.id,
        walletId
      );
    },
    createAndSelectWallet(reference?: string | null) {
      return OmsClientReactNativeSdk.createAndSelectWalletForPendingSelection(
        pendingSelection.id,
        reference ?? null
      );
    },
  };
}

function requireNativeField<T>(value: T | null | undefined, name: string): T {
  if (value == null) {
    throw new Error(`Native auth result is missing ${name}`);
  }
  return value;
}

function hydrateCompleteAuthResult(
  result: OmsNativeCompleteAuthResult
): OmsCompleteAuthResult {
  switch (result.type) {
    case 'walletSelected': {
      const wallet = requireNativeField(result.wallet, 'wallet');
      const walletAddress = requireNativeField(
        result.walletAddress,
        'walletAddress'
      );
      return {
        type: 'walletSelected',
        walletAddress,
        wallet,
        wallets: result.wallets,
        credential: result.credential,
      };
    }
    case 'walletSelection': {
      const pendingSelection = hydratePendingWalletSelection(
        requireNativeField(result.pendingSelection, 'pendingSelection')
      );
      return {
        type: 'walletSelection',
        walletAddress: null,
        wallet: null,
        wallets: pendingSelection.wallets,
        credential: pendingSelection.credential,
        pendingSelection,
      };
    }
    default:
      throw new Error(`Unsupported auth result type: ${result.type}`);
  }
}

function hydrateOidcRedirectAuthResult(
  result: OmsNativeOidcRedirectAuthResult
): OmsOidcRedirectAuthResult {
  switch (result.type) {
    case 'completed':
      return {
        type: 'completed',
        wallet: requireNativeField(result.wallet, 'wallet'),
      };
    case 'walletSelection':
      return {
        type: 'walletSelection',
        pendingSelection: hydratePendingWalletSelection(
          requireNativeField(result.pendingSelection, 'pendingSelection')
        ),
      };
    case 'notOidcRedirectCallback':
    case 'noPendingAuth':
      return { type: result.type };
    case 'failed':
      return {
        type: 'failed',
        message: result.message ?? 'OIDC redirect auth failed',
      };
    default:
      throw new Error(
        `Unsupported OIDC redirect auth result type: ${result.type}`
      );
  }
}

let nextFeeOptionSelectorId = 0;
let feeOptionSelectionSubscription: EventSubscription | null = null;
const feeOptionSelectors = new Map<string, OmsFeeOptionSelector>();

function ensureFeeOptionSelectionListener() {
  feeOptionSelectionSubscription ??=
    OmsClientReactNativeSdk.onFeeOptionSelectionRequest(
      handleFeeOptionSelectionRequest
    );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function handleFeeOptionSelectionRequest(
  event: OmsFeeOptionSelectionRequest
) {
  const selector = feeOptionSelectors.get(event.selectorId);
  if (selector == null) {
    await OmsClientReactNativeSdk.respondToFeeOptionSelection(
      event.requestId,
      null,
      `Fee option selector ${event.selectorId} is no longer registered`
    );
    return;
  }

  try {
    const selection = await selector(event.options);
    await OmsClientReactNativeSdk.respondToFeeOptionSelection(
      event.requestId,
      selection?.token ?? null,
      null
    );
  } catch (error) {
    await OmsClientReactNativeSdk.respondToFeeOptionSelection(
      event.requestId,
      null,
      errorMessage(error)
    );
  }
}

async function withFeeOptionSelector<T>(
  selector: OmsFeeOptionSelector | null | undefined,
  operation: (selectorId: string | null) => Promise<T>
): Promise<T> {
  if (selector == null) {
    return operation(null);
  }

  ensureFeeOptionSelectionListener();
  const selectorId = `fee-option-selector-${++nextFeeOptionSelectorId}`;
  feeOptionSelectors.set(selectorId, selector);
  try {
    return await operation(selectorId);
  } finally {
    feeOptionSelectors.delete(selectorId);
  }
}

export function configure(config: OmsClientConfig): Promise<void> {
  return OmsClientReactNativeSdk.configure(
    config.publishableKey,
    config.environment?.walletApiUrl ?? null,
    config.environment?.apiRpcUrl ?? null,
    config.environment?.indexerUrlTemplate ?? null,
    config.projectId
  );
}

export function getWalletAddress(): Promise<string | null> {
  return OmsClientReactNativeSdk.getWalletAddress();
}

export function getSession(): Promise<OmsClientSessionState> {
  return OmsClientReactNativeSdk.getSession() as Promise<OmsClientSessionState>;
}

export function onSessionExpired(
  listener: (event: OmsClientSessionExpiredEvent) => void
): EventSubscription {
  return OmsClientReactNativeSdk.onSessionExpired(
    listener as (event: OmsNativeClientSessionExpiredEvent) => void
  );
}

export function getSupportedNetworks(): Promise<OmsNetwork[]> {
  return OmsClientReactNativeSdk.getSupportedNetworks();
}

export function startEmailAuth(email: string): Promise<void> {
  return OmsClientReactNativeSdk.startEmailAuth(email);
}

export async function completeEmailAuth(
  params: CompleteEmailAuthParams
): Promise<OmsCompleteAuthResult> {
  return hydrateCompleteAuthResult(
    await OmsClientReactNativeSdk.completeEmailAuth(
      params.code,
      params.walletSelection ?? null,
      params.walletType ?? null,
      stringifyOptionalNumber(params.sessionLifetimeSeconds)
    )
  );
}

export async function signInWithOidcIdToken(
  params: SignInWithOidcIdTokenParams
): Promise<OmsCompleteAuthResult> {
  return hydrateCompleteAuthResult(
    await OmsClientReactNativeSdk.signInWithOidcIdToken(
      params.idToken,
      params.issuer,
      params.audience,
      params.walletSelection ?? null,
      params.walletType ?? null,
      stringifyOptionalNumber(params.sessionLifetimeSeconds)
    )
  );
}

export function startOidcRedirectAuth(
  params: StartOidcRedirectAuthParams
): Promise<OmsStartOidcRedirectAuthResult> {
  return OmsClientReactNativeSdk.startOidcRedirectAuth(
    stringifyRequiredJson(params.provider, 'provider'),
    params.redirectUri,
    params.walletType ?? null,
    resolveRelayRedirectUri(params),
    stringifyOptionalJson(params.authorizeParams),
    params.loginHint ?? null
  );
}

export async function handleOidcRedirectCallback(
  params: HandleOidcRedirectCallbackParams = {}
): Promise<OmsOidcRedirectAuthResult> {
  return hydrateOidcRedirectAuthResult(
    await OmsClientReactNativeSdk.handleOidcRedirectCallback(
      params.callbackUrl ?? null,
      params.walletSelection ?? null,
      stringifyOptionalNumber(params.sessionLifetimeSeconds)
    )
  );
}

export function listWallets(): Promise<OmsWallet[]> {
  return OmsClientReactNativeSdk.listWallets();
}

export function useWallet(
  walletId: string
): Promise<OmsWalletActivationResult> {
  return OmsClientReactNativeSdk.useWallet(walletId);
}

export function createWallet(
  params: CreateWalletParams = {}
): Promise<OmsWalletActivationResult> {
  return OmsClientReactNativeSdk.createWallet(
    params.walletType ?? null,
    params.reference ?? null
  );
}

export function signOut(): Promise<void> {
  return OmsClientReactNativeSdk.signOut();
}

export function signMessage(chainId: string, message: string): Promise<string> {
  return OmsClientReactNativeSdk.signMessage(chainId, message);
}

export function signTypedData(params: SignTypedDataParams): Promise<string> {
  return OmsClientReactNativeSdk.signTypedData(
    params.chainId,
    stringifyRequiredJson(params.typedData, 'typedData')
  );
}

export async function sendTransaction(
  params: SendTransactionParams
): Promise<OmsSendTransactionResponse> {
  return withFeeOptionSelector(params.selectFeeOption, (selectorId) =>
    OmsClientReactNativeSdk.sendTransaction(
      params.chainId,
      params.to,
      params.value,
      params.data ?? null,
      params.mode ?? null,
      selectorId,
      params.waitForStatus ?? true,
      stringifyOptionalNumber(params.statusPolling?.timeoutMs),
      stringifyOptionalNumber(params.statusPolling?.intervalMs),
      stringifyOptionalNumber(params.statusPolling?.fastIntervalMs),
      stringifyOptionalNumber(params.statusPolling?.fastPollCount)
    )
  );
}

export async function callContract(
  params: CallContractParams
): Promise<OmsSendTransactionResponse> {
  return withFeeOptionSelector(params.selectFeeOption, (selectorId) =>
    OmsClientReactNativeSdk.callContract(
      params.chainId,
      params.contractAddress,
      params.method,
      stringifyOptionalJson(params.args),
      params.mode ?? null,
      selectorId,
      params.waitForStatus ?? true,
      stringifyOptionalNumber(params.statusPolling?.timeoutMs),
      stringifyOptionalNumber(params.statusPolling?.intervalMs),
      stringifyOptionalNumber(params.statusPolling?.fastIntervalMs),
      stringifyOptionalNumber(params.statusPolling?.fastPollCount)
    )
  );
}

export function getTransactionStatus(
  txnId: string
): Promise<OmsTransactionStatus> {
  return OmsClientReactNativeSdk.getTransactionStatus(txnId);
}

export function getTokenBalances(
  params: GetTokenBalancesParams
): Promise<OmsTokenBalancesResult> {
  return OmsClientReactNativeSdk.getTokenBalances(
    params.chainId,
    params.contractAddress ?? null,
    params.walletAddress,
    params.includeMetadata ?? false,
    params.page?.page == null ? null : String(params.page.page),
    params.page?.pageSize == null ? null : String(params.page.pageSize)
  );
}

export function getNativeTokenBalance(
  params: GetNativeTokenBalanceParams
): Promise<OmsTokenBalance | null> {
  return OmsClientReactNativeSdk.getNativeTokenBalance(
    params.chainId,
    params.walletAddress
  );
}

export function verifyMessageSignature(
  params: VerifyMessageSignatureParams
): Promise<boolean> {
  return OmsClientReactNativeSdk.verifyMessageSignature(
    params.chainId,
    params.message,
    params.signature
  );
}

export function verifyTypedDataSignature(
  params: VerifyTypedDataSignatureParams
): Promise<boolean> {
  return OmsClientReactNativeSdk.verifyTypedDataSignature(
    params.chainId,
    stringifyRequiredJson(params.typedData, 'typedData'),
    params.signature
  );
}

export function getIdToken(params: GetIdTokenParams = {}): Promise<string> {
  return OmsClientReactNativeSdk.getIdToken(
    params.ttlSeconds == null ? null : String(params.ttlSeconds),
    stringifyOptionalJson(params.customClaims)
  );
}

export function listAccess(
  params: ListAccessParams = {}
): Promise<OmsCredentialInfo[]> {
  return OmsClientReactNativeSdk.listAccess(
    params.pageSize == null ? null : String(params.pageSize)
  );
}

export async function* listAccessPages(
  params: ListAccessPagesParams = {}
): AsyncGenerator<OmsListAccessResponse, void, void> {
  let cursor: string | null = null;

  do {
    const response = await listAccessPage({
      pageSize: params.pageSize,
      cursor,
    });
    yield response;
    cursor = response.page?.cursor ?? null;
  } while (cursor != null);
}

export function listAccessPage(
  params: ListAccessPageParams = {}
): Promise<OmsListAccessResponse> {
  return OmsClientReactNativeSdk.listAccessPage(
    params.pageSize == null ? null : String(params.pageSize),
    params.cursor ?? null
  );
}

export function revokeAccess(targetCredentialId: string): Promise<void> {
  return OmsClientReactNativeSdk.revokeAccess(targetCredentialId);
}
