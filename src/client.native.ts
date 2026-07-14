import type { EventSubscription } from 'react-native';
import NativeOmsWalletReactNativeSdk from './NativeOmsWalletReactNativeSdk';
import { normalizeNativeError } from './errors';
import { isOmsRelayOidcProvider } from './oidcProviders';
import type {
  OmsNativeFeeOptionSelectionRequest,
  OmsNativeCompleteAuthResult,
  OmsNativeFeeOptionWithBalance,
  OmsNativeOidcRedirectAuthResult,
  OmsNativePendingWalletSelection,
  OmsNativeSendTransactionResponse,
  OmsNativeSessionExpiredEvent,
  OmsNativeSessionState,
  OmsNativeTransactionStatus,
  OmsNativeTokenBalance,
  OmsNativeTokenContractInfo,
  OmsNativeTokenMetadata,
  OmsNativeTransaction,
  OmsNativeTransactionTransfer,
  OmsNativeWalletAccount,
  OmsNativeWalletActivationResult,
} from './NativeOmsWalletReactNativeSdk';
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
  BalancesResult,
  OMSWalletParams,
  OMSWalletSessionExpiredEvent,
  OMSWalletSessionState,
  CompleteAuthResult,
  CredentialInfo,
  FeeOptionWithBalance,
  FeeOptionSelector,
  ListAccessResponse,
  OidcRedirectAuthResult,
  PendingWalletSelection,
  SendTransactionResponse,
  StartOidcRedirectAuthResult,
  TransactionHistoryResult,
  TransactionStatusResponse,
  WalletAccount,
  WalletActivationResult,
  SendTransactionParams,
  SignMessageParams,
  SignInWithOidcIdTokenParams,
  SignTypedDataParams,
  StartEmailAuthParams,
  StartOidcRedirectAuthParams,
  TransactionStatus,
  TokenBalance,
  TokenContractInfo,
  TokenMetadata,
  Transaction,
  TransactionTransfer,
  IsValidMessageSignatureParams,
  IsValidTypedDataSignatureParams,
} from './types';

const OmsWalletReactNativeSdk = new Proxy(NativeOmsWalletReactNativeSdk, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value !== 'function') {
      return value;
    }
    return (...args: unknown[]) => {
      try {
        const result = Reflect.apply(value, target, args);
        if (
          result != null &&
          typeof (result as { then?: unknown }).then === 'function'
        ) {
          return Promise.resolve(result).catch((error) => {
            throw normalizeNativeError(error);
          });
        }
        return result;
      } catch (error) {
        throw normalizeNativeError(error);
      }
    };
  },
}) as typeof NativeOmsWalletReactNativeSdk;

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

function serializeOidcProvider(params: StartOidcRedirectAuthParams): string {
  if (isOmsRelayOidcProvider(params.provider)) {
    return stringifyRequiredJson(
      { type: 'oms-relay', provider: params.provider.provider },
      'provider'
    );
  }

  if (
    typeof params.provider.providerRedirectUri !== 'string' ||
    params.provider.providerRedirectUri.length === 0
  ) {
    throw new Error('Custom OIDC provider requires providerRedirectUri');
  }
  return stringifyRequiredJson(
    { ...params.provider, type: 'custom' },
    'provider'
  );
}

function omsRelayReturnUri(params: StartOidcRedirectAuthParams): string | null {
  if (!isOmsRelayOidcProvider(params.provider)) {
    return null;
  }
  if (
    typeof params.omsRelayReturnUri !== 'string' ||
    params.omsRelayReturnUri.length === 0
  ) {
    throw new Error('OMS relay OIDC provider requires omsRelayReturnUri');
  }
  return params.omsRelayReturnUri;
}

function serializeIndexerParams(params: IndexerParamsWithNetworks): string {
  return stringifyRequiredJson(
    {
      ...params,
      networks: params.networks?.map((network) => String(network.id)),
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

const nativeClientIdValue = 'oms-wallet';
let nextFeeOptionSelectorId = 0;
let currentClientGeneration = 0;
const clientGenerations = new WeakMap<OMSWallet, number>();
const clientReadiness = new WeakMap<OMSWallet, Promise<void>>();

function nativeClientId(owner: OMSWallet): string {
  if (!clientReadiness.has(owner)) {
    throw new Error('OMSWallet is not initialized');
  }
  if (clientGenerations.get(owner) !== currentClientGeneration) {
    throw new Error('This OMSWallet instance has been replaced');
  }
  return nativeClientIdValue;
}

function ensureReady(owner: OMSWallet): Promise<void> {
  const ready = clientReadiness.get(owner);
  if (ready == null) {
    throw new Error('OMSWallet is not initialized');
  }
  return ready;
}

function resetSessionExpiredReplay(owner: OMSWallet) {
  latestSessionExpiredEvents.delete(nativeClientId(owner));
}

let feeOptionSelectionSubscription: EventSubscription | null = null;
const feeOptionSelectors = new Map<string, FeeOptionSelector>();
let sessionExpiredSubscription: EventSubscription | null = null;
const latestSessionExpiredEvents = new Map<
  string,
  OMSWalletSessionExpiredEvent
>();
const sessionExpiredListeners = new Map<
  string,
  Set<(event: OMSWalletSessionExpiredEvent) => void>
>();
const activateNativeWallet = OmsWalletReactNativeSdk.useWallet.bind(
  OmsWalletReactNativeSdk
);

function ensureFeeOptionSelectionListener() {
  feeOptionSelectionSubscription ??=
    OmsWalletReactNativeSdk.onFeeOptionSelectionRequest(
      handleFeeOptionSelectionRequest
    );
}

function handleNativeSessionExpired(event: OmsNativeSessionExpiredEvent) {
  const sessionExpiredEvent: OMSWalletSessionExpiredEvent = {
    session: hydrateSessionState(event.session),
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
  sessionExpiredSubscription ??= OmsWalletReactNativeSdk.onSessionExpired(
    handleNativeSessionExpired
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function handleFeeOptionSelectionRequest(
  event: OmsNativeFeeOptionSelectionRequest
) {
  const selector = feeOptionSelectors.get(event.selectorId);
  if (selector == null) {
    await OmsWalletReactNativeSdk.respondToFeeOptionSelection(
      event.requestId,
      null,
      `Fee option selector ${event.selectorId} is no longer registered`
    );
    return;
  }

  try {
    const selection = await selector(
      event.options.map(hydrateFeeOptionWithBalance)
    );
    await OmsWalletReactNativeSdk.respondToFeeOptionSelection(
      event.requestId,
      selection?.token ?? null,
      null
    );
  } catch (error) {
    await OmsWalletReactNativeSdk.respondToFeeOptionSelection(
      event.requestId,
      null,
      errorMessage(error)
    );
  }
}

function hydrateWalletType(value: string): WalletAccount['type'] {
  if (value !== 'ethereum') {
    throw new Error(`Unsupported wallet type from native SDK: ${value}`);
  }
  return value;
}

function hydrateObject(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

function hydrateTokenContractInfo(
  info: OmsNativeTokenContractInfo
): TokenContractInfo {
  return {
    ...info,
    extensions:
      info.extensions == null
        ? info.extensions
        : hydrateObject(info.extensions),
  };
}

function hydrateTokenMetadata(metadata: OmsNativeTokenMetadata): TokenMetadata {
  return {
    ...metadata,
    properties:
      metadata.properties == null
        ? metadata.properties
        : hydrateObject(metadata.properties),
    attributes:
      metadata.attributes == null
        ? metadata.attributes
        : metadata.attributes.map(hydrateObject),
  };
}

function hydrateTokenBalance(balance: OmsNativeTokenBalance): TokenBalance {
  return {
    ...balance,
    contractInfo:
      balance.contractInfo == null
        ? balance.contractInfo
        : hydrateTokenContractInfo(balance.contractInfo),
    tokenMetadata:
      balance.tokenMetadata == null
        ? balance.tokenMetadata
        : hydrateTokenMetadata(balance.tokenMetadata),
  };
}

function hydrateFeeOptionWithBalance(
  option: OmsNativeFeeOptionWithBalance
): FeeOptionWithBalance {
  return {
    ...option,
    balance:
      option.balance == null ? null : hydrateTokenBalance(option.balance),
  };
}

function hydrateTransactionTransfer(
  transfer: OmsNativeTransactionTransfer
): TransactionTransfer {
  return {
    ...transfer,
    contractInfo:
      transfer.contractInfo == null
        ? transfer.contractInfo
        : hydrateTokenContractInfo(transfer.contractInfo),
    tokenMetadata:
      transfer.tokenMetadata == null
        ? transfer.tokenMetadata
        : hydrateObject(transfer.tokenMetadata),
  };
}

function hydrateTransaction(transaction: OmsNativeTransaction): Transaction {
  return {
    ...transaction,
    transfers: transaction.transfers?.map(hydrateTransactionTransfer),
  };
}

function hydrateWalletAccount(wallet: OmsNativeWalletAccount): WalletAccount {
  return { ...wallet, type: hydrateWalletType(wallet.type) };
}

function hydrateWalletActivationResult(
  result: OmsNativeWalletActivationResult
): WalletActivationResult {
  return {
    walletAddress: result.walletAddress,
    wallet: hydrateWalletAccount(result.wallet),
  };
}

function hydrateTransactionStatus(value: string): TransactionStatus {
  switch (value) {
    case 'quoted':
    case 'pending':
    case 'executed':
    case 'failed':
    case 'unknown':
      return value;
    default:
      throw new Error(
        `Unsupported transaction status from native SDK: ${value}`
      );
  }
}

function hydrateSendTransactionResponse(
  response: OmsNativeSendTransactionResponse
): SendTransactionResponse {
  return { ...response, status: hydrateTransactionStatus(response.status) };
}

function hydrateTransactionStatusResponse(
  response: OmsNativeTransactionStatus
): TransactionStatusResponse {
  return { ...response, status: hydrateTransactionStatus(response.status) };
}

function hydrateSessionState(
  session: OmsNativeSessionState
): OMSWalletSessionState {
  const auth = session.auth;
  if (auth == null) {
    return { ...session, auth: null };
  }
  if (auth.type === 'email') {
    return {
      ...session,
      auth: { type: 'email', email: auth.email },
    };
  }
  if (auth.type === 'oidc') {
    if (auth.flow !== 'redirect' && auth.flow !== 'id-token') {
      throw new Error(
        `Unsupported OIDC auth flow from native SDK: ${auth.flow}`
      );
    }
    if (auth.issuer == null) {
      throw new Error('Native OIDC session is missing issuer');
    }
    return {
      ...session,
      auth: {
        type: 'oidc',
        flow: auth.flow,
        issuer: auth.issuer,
        provider: auth.provider ?? null,
        providerLabel: auth.providerLabel ?? null,
        email: auth.email,
      },
    };
  }
  throw new Error(
    `Unsupported session auth type from native SDK: ${auth.type}`
  );
}

async function withFeeOptionSelector<T>(
  selector: FeeOptionSelector | null | undefined,
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
  owner: OMSWallet,
  pendingSelection: OmsNativePendingWalletSelection
): PendingWalletSelection {
  const { id } = pendingSelection;
  return {
    walletType: hydrateWalletType(pendingSelection.walletType),
    wallets: pendingSelection.wallets.map(hydrateWalletAccount),
    credential: pendingSelection.credential,
    async selectWallet(walletId: string) {
      await ensureReady(owner);
      const result =
        await OmsWalletReactNativeSdk.selectWalletForPendingSelection(
          nativeClientId(owner),
          id,
          walletId
        );
      resetSessionExpiredReplay(owner);
      return hydrateWalletActivationResult(result);
    },
    async createAndSelectWallet(reference?: string | null) {
      await ensureReady(owner);
      const result =
        await OmsWalletReactNativeSdk.createAndSelectWalletForPendingSelection(
          nativeClientId(owner),
          id,
          reference ?? null
        );
      resetSessionExpiredReplay(owner);
      return hydrateWalletActivationResult(result);
    },
  };
}

function hydrateCompleteAuthResult(
  owner: OMSWallet,
  result: OmsNativeCompleteAuthResult
): CompleteAuthResult {
  switch (result.type) {
    case 'walletSelected': {
      const wallet = hydrateWalletAccount(
        requireNativeField(result.wallet, 'wallet')
      );
      const walletAddress = requireNativeField(
        result.walletAddress,
        'walletAddress'
      );
      return {
        type: 'walletSelected',
        walletAddress,
        wallet,
        wallets: result.wallets.map(hydrateWalletAccount),
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
  owner: OMSWallet,
  result: OmsNativeOidcRedirectAuthResult
): OidcRedirectAuthResult {
  switch (result.type) {
    case 'completed':
      return {
        type: 'completed',
        result: hydrateCompleteAuthResult(
          owner,
          requireNativeField(result.result, 'result')
        ),
      };
    case 'notOidcRedirectCallback':
    case 'noPendingAuth':
      return { type: result.type };
    default:
      throw new Error(
        `Unsupported OIDC redirect auth result type: ${result.type}`
      );
  }
}

export class OMSWallet {
  public readonly wallet: OMSWalletClient;
  public readonly indexer: OMSIndexerClient;

  constructor(config: OMSWalletParams) {
    ensureSessionExpiredListener();
    currentClientGeneration += 1;
    clientGenerations.set(this, currentClientGeneration);
    feeOptionSelectors.clear();
    sessionExpiredListeners.delete(nativeClientIdValue);
    latestSessionExpiredEvents.delete(nativeClientIdValue);
    clientReadiness.set(
      this,
      OmsWalletReactNativeSdk.createClient(
        nativeClientIdValue,
        config.publishableKey
      )
    );
    this.wallet = new OMSWalletClient(this);
    this.indexer = new OMSIndexerClient(this);
  }
}

export class OMSWalletClient {
  constructor(private readonly owner: OMSWallet) {}

  async getWalletAddress(): Promise<string | null> {
    await ensureReady(this.owner);
    return OmsWalletReactNativeSdk.getWalletAddress(nativeClientId(this.owner));
  }

  async getSession(): Promise<OMSWalletSessionState> {
    await ensureReady(this.owner);
    return hydrateSessionState(
      await OmsWalletReactNativeSdk.getSession(nativeClientId(this.owner))
    );
  }

  onSessionExpired(
    listener: (event: OMSWalletSessionExpiredEvent) => void
  ): EventSubscription {
    ensureSessionExpiredListener();
    const clientId = nativeClientId(this.owner);
    let listeners = sessionExpiredListeners.get(clientId);
    if (listeners == null) {
      listeners = new Set();
      sessionExpiredListeners.set(clientId, listeners);
    }
    listeners.add(listener);

    const latestSessionExpiredEvent = latestSessionExpiredEvents.get(clientId);
    if (latestSessionExpiredEvent != null) {
      listener(latestSessionExpiredEvent);
    }

    return {
      remove: () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          sessionExpiredListeners.delete(clientId);
        }
      },
    };
  }

  async startEmailAuth(params: StartEmailAuthParams): Promise<void> {
    await ensureReady(this.owner);
    resetSessionExpiredReplay(this.owner);
    return OmsWalletReactNativeSdk.startEmailAuth(
      nativeClientId(this.owner),
      params.email,
      stringifyOptionalNumber(params.sessionLifetimeSeconds)
    );
  }

  async completeEmailAuth(
    params: CompleteEmailAuthParams
  ): Promise<CompleteAuthResult> {
    await ensureReady(this.owner);
    const result = hydrateCompleteAuthResult(
      this.owner,
      await OmsWalletReactNativeSdk.completeEmailAuth(
        nativeClientId(this.owner),
        params.code,
        params.walletSelection ?? null,
        params.walletType ?? null
      )
    );
    resetSessionExpiredReplay(this.owner);
    return result;
  }

  async signInWithOidcIdToken(
    params: SignInWithOidcIdTokenParams
  ): Promise<CompleteAuthResult> {
    await ensureReady(this.owner);
    resetSessionExpiredReplay(this.owner);
    return hydrateCompleteAuthResult(
      this.owner,
      await OmsWalletReactNativeSdk.signInWithOidcIdToken(
        nativeClientId(this.owner),
        params.idToken,
        params.issuer,
        params.audience,
        params.walletSelection ?? null,
        params.walletType ?? null,
        stringifyOptionalNumber(params.sessionLifetimeSeconds),
        params.provider ?? null,
        params.providerLabel ?? null
      )
    );
  }

  async startOidcRedirectAuth(
    params: StartOidcRedirectAuthParams
  ): Promise<StartOidcRedirectAuthResult> {
    await ensureReady(this.owner);
    resetSessionExpiredReplay(this.owner);
    return OmsWalletReactNativeSdk.startOidcRedirectAuth(
      nativeClientId(this.owner),
      serializeOidcProvider(params),
      omsRelayReturnUri(params),
      params.walletType ?? null,
      params.walletSelection ?? null,
      stringifyOptionalNumber(params.sessionLifetimeSeconds),
      stringifyOptionalJson(params.authorizeParams),
      params.loginHint ?? null
    );
  }

  async handleOidcRedirectCallback(
    params: HandleOidcRedirectCallbackParams
  ): Promise<OidcRedirectAuthResult> {
    await ensureReady(this.owner);
    const result = hydrateOidcRedirectAuthResult(
      this.owner,
      await OmsWalletReactNativeSdk.handleOidcRedirectCallback(
        nativeClientId(this.owner),
        params.callbackUrl,
        params.walletSelection ?? null,
        stringifyOptionalNumber(params.sessionLifetimeSeconds)
      )
    );
    if (
      result.type !== 'notOidcRedirectCallback' &&
      result.type !== 'noPendingAuth'
    ) {
      resetSessionExpiredReplay(this.owner);
    }
    return result;
  }

  async listWallets(): Promise<WalletAccount[]> {
    await ensureReady(this.owner);
    return (
      await OmsWalletReactNativeSdk.listWallets(nativeClientId(this.owner))
    ).map(hydrateWalletAccount);
  }

  async useWallet(walletId: string): Promise<WalletActivationResult> {
    await ensureReady(this.owner);
    const result = await activateNativeWallet(
      nativeClientId(this.owner),
      walletId
    );
    resetSessionExpiredReplay(this.owner);
    return hydrateWalletActivationResult(result);
  }

  async createWallet(
    params: CreateWalletParams = {}
  ): Promise<WalletActivationResult> {
    await ensureReady(this.owner);
    const result = await OmsWalletReactNativeSdk.createWallet(
      nativeClientId(this.owner),
      params.walletType ?? null,
      params.reference ?? null
    );
    resetSessionExpiredReplay(this.owner);
    return hydrateWalletActivationResult(result);
  }

  async signOut(): Promise<void> {
    await ensureReady(this.owner);
    resetSessionExpiredReplay(this.owner);
    return OmsWalletReactNativeSdk.signOut(nativeClientId(this.owner));
  }

  async signMessage(params: SignMessageParams): Promise<string> {
    await ensureReady(this.owner);
    return OmsWalletReactNativeSdk.signMessage(
      nativeClientId(this.owner),
      String(params.network.id),
      params.message
    );
  }

  async signTypedData(params: SignTypedDataParams): Promise<string> {
    await ensureReady(this.owner);
    return OmsWalletReactNativeSdk.signTypedData(
      nativeClientId(this.owner),
      String(params.network.id),
      stringifyRequiredJson(params.typedData, 'typedData')
    );
  }

  async sendTransaction(
    params: SendTransactionParams
  ): Promise<SendTransactionResponse> {
    await ensureReady(this.owner);
    return hydrateSendTransactionResponse(
      await withFeeOptionSelector(params.selectFeeOption, (selectorId) =>
        OmsWalletReactNativeSdk.sendTransaction(
          nativeClientId(this.owner),
          String(params.network.id),
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
      )
    );
  }

  async callContract(
    params: CallContractParams
  ): Promise<SendTransactionResponse> {
    await ensureReady(this.owner);
    return hydrateSendTransactionResponse(
      await withFeeOptionSelector(params.selectFeeOption, (selectorId) =>
        OmsWalletReactNativeSdk.callContract(
          nativeClientId(this.owner),
          String(params.network.id),
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
      )
    );
  }

  async getTransactionStatus(
    txnId: string
  ): Promise<TransactionStatusResponse> {
    await ensureReady(this.owner);
    return hydrateTransactionStatusResponse(
      await OmsWalletReactNativeSdk.getTransactionStatus(
        nativeClientId(this.owner),
        txnId
      )
    );
  }

  async isValidMessageSignature(
    params: IsValidMessageSignatureParams
  ): Promise<boolean> {
    await ensureReady(this.owner);
    return OmsWalletReactNativeSdk.verifyMessageSignature(
      nativeClientId(this.owner),
      String(params.network.id),
      params.message,
      params.signature
    );
  }

  async isValidTypedDataSignature(
    params: IsValidTypedDataSignatureParams
  ): Promise<boolean> {
    await ensureReady(this.owner);
    return OmsWalletReactNativeSdk.verifyTypedDataSignature(
      nativeClientId(this.owner),
      String(params.network.id),
      stringifyRequiredJson(params.typedData, 'typedData'),
      params.signature
    );
  }

  async getIdToken(params: GetIdTokenParams = {}): Promise<string> {
    await ensureReady(this.owner);
    return OmsWalletReactNativeSdk.getIdToken(
      nativeClientId(this.owner),
      params.ttlSeconds == null ? null : String(params.ttlSeconds),
      stringifyOptionalJson(params.customClaims)
    );
  }

  async listAccess(params: ListAccessParams = {}): Promise<CredentialInfo[]> {
    await ensureReady(this.owner);
    return OmsWalletReactNativeSdk.listAccess(
      nativeClientId(this.owner),
      params.pageSize == null ? null : String(params.pageSize)
    );
  }

  async *listAccessPages(
    params: ListAccessPagesParams = {}
  ): AsyncGenerator<ListAccessResponse, void, void> {
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
  ): Promise<ListAccessResponse> {
    await ensureReady(this.owner);
    return OmsWalletReactNativeSdk.listAccessPage(
      nativeClientId(this.owner),
      params.pageSize == null ? null : String(params.pageSize),
      params.cursor ?? null
    );
  }

  async revokeAccess(targetCredentialId: string): Promise<void> {
    await ensureReady(this.owner);
    return OmsWalletReactNativeSdk.revokeAccess(
      nativeClientId(this.owner),
      targetCredentialId
    );
  }
}

export class OMSIndexerClient {
  constructor(private readonly owner: OMSWallet) {}

  async getBalances(params: GetBalancesParams): Promise<BalancesResult> {
    await ensureReady(this.owner);
    const result = await OmsWalletReactNativeSdk.getBalances(
      nativeClientId(this.owner),
      serializeIndexerParams(params)
    );
    return {
      ...result,
      nativeBalances: result.nativeBalances.map(hydrateTokenBalance),
      balances: result.balances.map(hydrateTokenBalance),
    };
  }

  async getTransactionHistory(
    params: GetTransactionHistoryParams
  ): Promise<TransactionHistoryResult> {
    await ensureReady(this.owner);
    const result = await OmsWalletReactNativeSdk.getTransactionHistory(
      nativeClientId(this.owner),
      serializeIndexerParams(params)
    );
    return {
      ...result,
      transactions: result.transactions.map(hydrateTransaction),
    };
  }
}
