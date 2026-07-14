export type OMSWalletErrorCode =
  | 'OMS_HTTP_ERROR'
  | 'OMS_INVALID_RESPONSE'
  | 'OMS_REQUEST_FAILED'
  | 'OMS_AUTH_COMMITMENT_CONSUMED'
  | 'OMS_SESSION_MISSING'
  | 'OMS_SESSION_EXPIRED'
  | 'OMS_WALLET_SELECTION_STALE'
  | 'OMS_WALLET_SELECTION_UNAVAILABLE'
  | 'OMS_WALLET_SELECTION_IN_FLIGHT'
  | 'OMS_TRANSACTION_EXECUTION_UNCONFIRMED'
  | 'OMS_TRANSACTION_STATUS_LOOKUP_FAILED'
  | 'OMS_VALIDATION_ERROR'
  | 'OMS_STORAGE_ERROR';

export type OMSWalletUpstreamError = {
  service: 'waas' | 'indexer';
  name?: string;
  code?: string;
  message?: string;
  status?: number;
};

export type OMSWalletErrorDetails = {
  operation?: string;
  status?: number;
  txnId?: string;
  retryable?: boolean;
  upstreamError?: OMSWalletUpstreamError;
};

const errorCodes = new Set<OMSWalletErrorCode>([
  'OMS_HTTP_ERROR',
  'OMS_INVALID_RESPONSE',
  'OMS_REQUEST_FAILED',
  'OMS_AUTH_COMMITMENT_CONSUMED',
  'OMS_SESSION_MISSING',
  'OMS_SESSION_EXPIRED',
  'OMS_WALLET_SELECTION_STALE',
  'OMS_WALLET_SELECTION_UNAVAILABLE',
  'OMS_WALLET_SELECTION_IN_FLIGHT',
  'OMS_TRANSACTION_EXECUTION_UNCONFIRMED',
  'OMS_TRANSACTION_STATUS_LOOKUP_FAILED',
  'OMS_VALIDATION_ERROR',
  'OMS_STORAGE_ERROR',
]);

export class OMSWalletError extends Error {
  readonly code: OMSWalletErrorCode;
  readonly operation?: string;
  readonly status?: number;
  readonly txnId?: string;
  readonly retryable?: boolean;
  readonly upstreamError?: OMSWalletUpstreamError;

  constructor(
    code: OMSWalletErrorCode,
    message: string,
    details: Partial<OMSWalletErrorDetails> = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OMSWalletError';
    this.code = code;
    this.operation = details.operation;
    this.status = details.status;
    this.txnId = details.txnId;
    this.retryable = details.retryable;
    this.upstreamError = details.upstreamError;
  }
}

export function isOMSWalletError(error: unknown): error is OMSWalletError {
  return error instanceof OMSWalletError;
}

export function normalizeNativeError(error: unknown): Error {
  const source = record(error);
  const userInfo = record(source?.userInfo);
  const code = stringValue(userInfo?.code) ?? stringValue(source?.code);
  if (code == null || !errorCodes.has(code as OMSWalletErrorCode)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  return new OMSWalletError(
    code as OMSWalletErrorCode,
    error instanceof Error ? error.message : String(error),
    {
      operation: optionalString(userInfo?.operation),
      status: optionalNumber(userInfo?.status),
      txnId: optionalString(userInfo?.txnId),
      retryable: optionalBoolean(userInfo?.retryable),
      upstreamError: upstreamError(userInfo?.upstreamError),
    },
    error instanceof Error ? { cause: error } : undefined
  );
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value != null
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return value == null ? undefined : stringValue(value);
}

function optionalNumber(value: unknown): number | undefined {
  return value == null || typeof value !== 'number' ? undefined : value;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return value == null || typeof value !== 'boolean' ? undefined : value;
}

function upstreamError(value: unknown): OMSWalletUpstreamError | undefined {
  const item = record(value);
  if (item == null || (item.service !== 'waas' && item.service !== 'indexer')) {
    return undefined;
  }
  return {
    service: item.service,
    name: optionalString(item.name),
    code: optionalString(item.code),
    message: optionalString(item.message),
    status: optionalNumber(item.status),
  };
}
