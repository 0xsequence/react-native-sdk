import type { EventSubscription } from 'react-native';
import OmsClientReactNativeSdk from './NativeOmsClientReactNativeSdk';
import type {
  OmsClientSessionExpiredEvent as OmsNativeClientSessionExpiredEvent,
  OmsFeeOptionSelectionRequest,
  OmsNativeCompleteAuthResult,
  OmsNativeOidcRedirectAuthResult,
  OmsNativePendingWalletSelection,
} from './NativeOmsClientReactNativeSdk';
import { supportedNetworks } from './networks';
import type {
  CallContractParams,
  CompleteEmailAuthParams,
  CreateWalletParams,
  GetBalancesParams,
  GetIdTokenParams,
  GetTransactionHistoryParams,
  HandleOidcRedirectCallbackParams,
  ListAccessPageParams,
  ListAccessPagesParams,
  ListAccessParams,
  OmsBalancesResult,
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
  OmsTransactionHistoryResult,
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

type IndexerParamsWithNetworks =
  | GetBalancesParams
  | GetTransactionHistoryParams;

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

function serializeIndexerParams(params: IndexerParamsWithNetworks): string {
  return stringifyRequiredJson(
    {
      ...params,
      networks: params.networks?.map((network) => network.chainId),
    },
    'params'
  );
}

function requireNativeField<T>(value: T | null | undefined, name: string): T {
  if (value == null) {
    throw new Error(`Native auth result is missing ${name}`);
  }
  return value;
}

let nextClientId = 0;
let nextFeeOptionSelectorId = 0;
let feeOptionSelectionSubscription: EventSubscription | null = null;
const feeOptionSelectors = new Map<string, OmsFeeOptionSelector>();
let sessionExpiredSubscription: EventSubscription | null = null;
const latestSessionExpiredEvents = new Map<
  string,
  OmsClientSessionExpiredEvent
>();
const sessionExpiredListeners = new Map<
  string,
  Set<(event: OmsClientSessionExpiredEvent) => void>
>();
const activateNativeWallet = OmsClientReactNativeSdk.useWallet.bind(
  OmsClientReactNativeSdk
);

function ensureFeeOptionSelectionListener() {
  feeOptionSelectionSubscription ??=
    OmsClientReactNativeSdk.onFeeOptionSelectionRequest(
      handleFeeOptionSelectionRequest
    );
}

function handleNativeSessionExpired(event: OmsNativeClientSessionExpiredEvent) {
  const sessionExpiredEvent: OmsClientSessionExpiredEvent = {
    session: event.session as OmsClientSessionState,
    expiredAt: event.expiredAt,
  };
  latestSessionExpiredEvents.set(event.clientId, sessionExpiredEvent);
  const listeners = sessionExpiredListeners.get(event.clientId);
  if (listeners == null) {
    return;
  }
  for (const listener of Array.from(listeners)) {
    listener(sessionExpiredEvent);
  }
}

function ensureSessionExpiredListener() {
  sessionExpiredSubscription ??= OmsClientReactNativeSdk.onSessionExpired(
    handleNativeSessionExpired
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

function hydratePendingWalletSelection(
  owner: OMSClient,
  pendingSelection: OmsNativePendingWalletSelection
): OmsPendingWalletSelection {
  return {
    ...pendingSelection,
    walletType:
      pendingSelection.walletType as OmsPendingWalletSelection['walletType'],
    async selectWallet(walletId: string) {
      await owner.ensureReady();
      const result =
        await OmsClientReactNativeSdk.selectWalletForPendingSelection(
          owner.clientId,
          pendingSelection.id,
          walletId
        );
      owner.resetSessionExpiredReplay();
      return result;
    },
    async createAndSelectWallet(reference?: string | null) {
      await owner.ensureReady();
      const result =
        await OmsClientReactNativeSdk.createAndSelectWalletForPendingSelection(
          owner.clientId,
          pendingSelection.id,
          reference ?? null
        );
      owner.resetSessionExpiredReplay();
      return result;
    },
  };
}

function hydrateCompleteAuthResult(
  owner: OMSClient,
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
        owner,
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
  owner: OMSClient,
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
          owner,
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

export class OMSClient {
  public readonly wallet: OMSWalletClient;
  public readonly indexer: OMSIndexerClient;
  public readonly supportedNetworks: OmsNetwork[] = supportedNetworks;
  public readonly clientId: string;
  private readonly ready: Promise<void>;

  constructor(config: OmsClientConfig) {
    ensureSessionExpiredListener();
    this.clientId = `oms-client-${++nextClientId}`;
    this.ready = OmsClientReactNativeSdk.createClient(
      this.clientId,
      config.publishableKey
    );
    this.wallet = new OMSWalletClient(this);
    this.indexer = new OMSIndexerClient(this);
  }

  public ensureReady(): Promise<void> {
    return this.ready;
  }

  public resetSessionExpiredReplay() {
    latestSessionExpiredEvents.delete(this.clientId);
  }
}

export class OMSWalletClient {
  constructor(private readonly owner: OMSClient) {}

  async getWalletAddress(): Promise<string | null> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.getWalletAddress(this.owner.clientId);
  }

  async getSession(): Promise<OmsClientSessionState> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.getSession(
      this.owner.clientId
    ) as Promise<OmsClientSessionState>;
  }

  onSessionExpired(
    listener: (event: OmsClientSessionExpiredEvent) => void
  ): EventSubscription {
    ensureSessionExpiredListener();
    let listeners = sessionExpiredListeners.get(this.owner.clientId);
    if (listeners == null) {
      listeners = new Set();
      sessionExpiredListeners.set(this.owner.clientId, listeners);
    }
    listeners.add(listener);

    const latestSessionExpiredEvent = latestSessionExpiredEvents.get(
      this.owner.clientId
    );
    if (latestSessionExpiredEvent != null) {
      listener(latestSessionExpiredEvent);
    }

    return {
      remove: () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          sessionExpiredListeners.delete(this.owner.clientId);
        }
      },
    };
  }

  async startEmailAuth(email: string): Promise<void> {
    await this.owner.ensureReady();
    this.owner.resetSessionExpiredReplay();
    return OmsClientReactNativeSdk.startEmailAuth(this.owner.clientId, email);
  }

  async completeEmailAuth(
    params: CompleteEmailAuthParams
  ): Promise<OmsCompleteAuthResult> {
    await this.owner.ensureReady();
    const result = hydrateCompleteAuthResult(
      this.owner,
      await OmsClientReactNativeSdk.completeEmailAuth(
        this.owner.clientId,
        params.code,
        params.walletSelection ?? null,
        params.walletType ?? null,
        stringifyOptionalNumber(params.sessionLifetimeSeconds)
      )
    );
    this.owner.resetSessionExpiredReplay();
    return result;
  }

  async signInWithOidcIdToken(
    params: SignInWithOidcIdTokenParams
  ): Promise<OmsCompleteAuthResult> {
    await this.owner.ensureReady();
    this.owner.resetSessionExpiredReplay();
    return hydrateCompleteAuthResult(
      this.owner,
      await OmsClientReactNativeSdk.signInWithOidcIdToken(
        this.owner.clientId,
        params.idToken,
        params.issuer,
        params.audience,
        params.walletSelection ?? null,
        params.walletType ?? null,
        stringifyOptionalNumber(params.sessionLifetimeSeconds)
      )
    );
  }

  async startOidcRedirectAuth(
    params: StartOidcRedirectAuthParams
  ): Promise<OmsStartOidcRedirectAuthResult> {
    await this.owner.ensureReady();
    this.owner.resetSessionExpiredReplay();
    return OmsClientReactNativeSdk.startOidcRedirectAuth(
      this.owner.clientId,
      stringifyRequiredJson(params.provider, 'provider'),
      params.redirectUri,
      params.walletType ?? null,
      resolveRelayRedirectUri(params),
      stringifyOptionalJson(params.authorizeParams),
      params.loginHint ?? null
    );
  }

  async handleOidcRedirectCallback(
    params: HandleOidcRedirectCallbackParams = {}
  ): Promise<OmsOidcRedirectAuthResult> {
    await this.owner.ensureReady();
    const result = hydrateOidcRedirectAuthResult(
      this.owner,
      await OmsClientReactNativeSdk.handleOidcRedirectCallback(
        this.owner.clientId,
        params.callbackUrl ?? null,
        params.walletSelection ?? null,
        stringifyOptionalNumber(params.sessionLifetimeSeconds)
      )
    );
    if (
      result.type !== 'notOidcRedirectCallback' &&
      result.type !== 'noPendingAuth'
    ) {
      this.owner.resetSessionExpiredReplay();
    }
    return result;
  }

  async listWallets(): Promise<OmsWallet[]> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.listWallets(this.owner.clientId);
  }

  async useWallet(walletId: string): Promise<OmsWalletActivationResult> {
    await this.owner.ensureReady();
    const result = await activateNativeWallet(this.owner.clientId, walletId);
    this.owner.resetSessionExpiredReplay();
    return result;
  }

  async createWallet(
    params: CreateWalletParams = {}
  ): Promise<OmsWalletActivationResult> {
    await this.owner.ensureReady();
    const result = await OmsClientReactNativeSdk.createWallet(
      this.owner.clientId,
      params.walletType ?? null,
      params.reference ?? null
    );
    this.owner.resetSessionExpiredReplay();
    return result;
  }

  async signOut(): Promise<void> {
    await this.owner.ensureReady();
    this.owner.resetSessionExpiredReplay();
    return OmsClientReactNativeSdk.signOut(this.owner.clientId);
  }

  async signMessage(chainId: string, message: string): Promise<string> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.signMessage(
      this.owner.clientId,
      chainId,
      message
    );
  }

  async signTypedData(params: SignTypedDataParams): Promise<string> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.signTypedData(
      this.owner.clientId,
      params.chainId,
      stringifyRequiredJson(params.typedData, 'typedData')
    );
  }

  async sendTransaction(
    params: SendTransactionParams
  ): Promise<OmsSendTransactionResponse> {
    await this.owner.ensureReady();
    return withFeeOptionSelector(params.selectFeeOption, (selectorId) =>
      OmsClientReactNativeSdk.sendTransaction(
        this.owner.clientId,
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

  async callContract(
    params: CallContractParams
  ): Promise<OmsSendTransactionResponse> {
    await this.owner.ensureReady();
    return withFeeOptionSelector(params.selectFeeOption, (selectorId) =>
      OmsClientReactNativeSdk.callContract(
        this.owner.clientId,
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

  async getTransactionStatus(txnId: string): Promise<OmsTransactionStatus> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.getTransactionStatus(
      this.owner.clientId,
      txnId
    );
  }

  async verifyMessageSignature(
    params: VerifyMessageSignatureParams
  ): Promise<boolean> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.verifyMessageSignature(
      this.owner.clientId,
      params.chainId,
      params.message,
      params.signature
    );
  }

  async verifyTypedDataSignature(
    params: VerifyTypedDataSignatureParams
  ): Promise<boolean> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.verifyTypedDataSignature(
      this.owner.clientId,
      params.chainId,
      stringifyRequiredJson(params.typedData, 'typedData'),
      params.signature
    );
  }

  async getIdToken(params: GetIdTokenParams = {}): Promise<string> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.getIdToken(
      this.owner.clientId,
      params.ttlSeconds == null ? null : String(params.ttlSeconds),
      stringifyOptionalJson(params.customClaims)
    );
  }

  async listAccess(
    params: ListAccessParams = {}
  ): Promise<OmsCredentialInfo[]> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.listAccess(
      this.owner.clientId,
      params.pageSize == null ? null : String(params.pageSize)
    );
  }

  async *listAccessPages(
    params: ListAccessPagesParams = {}
  ): AsyncGenerator<OmsListAccessResponse, void, void> {
    let cursor: string | null = null;

    do {
      const response = await this.listAccessPage({
        pageSize: params.pageSize,
        cursor,
      });
      yield response;
      cursor = response.page?.cursor ?? null;
    } while (cursor != null);
  }

  async listAccessPage(
    params: ListAccessPageParams = {}
  ): Promise<OmsListAccessResponse> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.listAccessPage(
      this.owner.clientId,
      params.pageSize == null ? null : String(params.pageSize),
      params.cursor ?? null
    );
  }

  async revokeAccess(targetCredentialId: string): Promise<void> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.revokeAccess(
      this.owner.clientId,
      targetCredentialId
    );
  }
}

export class OMSIndexerClient {
  constructor(private readonly owner: OMSClient) {}

  async getBalances(params: GetBalancesParams): Promise<OmsBalancesResult> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.getBalances(
      this.owner.clientId,
      serializeIndexerParams(params)
    );
  }

  async getTransactionHistory(
    params: GetTransactionHistoryParams
  ): Promise<OmsTransactionHistoryResult> {
    await this.owner.ensureReady();
    return OmsClientReactNativeSdk.getTransactionHistory(
      this.owner.clientId,
      serializeIndexerParams(params)
    );
  }
}
