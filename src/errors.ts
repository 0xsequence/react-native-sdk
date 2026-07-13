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
  name: string | null;
  code: string | null;
  message: string | null;
  status: number | null;
};

export type OMSWalletErrorDetails = {
  operation: string | null;
  status: number | null;
  txnId: string | null;
  retryable: boolean | null;
  upstreamError: OMSWalletUpstreamError | null;
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
  readonly operation: string | null;
  readonly status: number | null;
  readonly txnId: string | null;
  readonly retryable: boolean | null;
  readonly upstreamError: OMSWalletUpstreamError | null;

  constructor(
    code: OMSWalletErrorCode,
    message: string,
    details: Partial<OMSWalletErrorDetails> = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OMSWalletError';
    this.code = code;
    this.operation = details.operation ?? null;
    this.status = details.status ?? null;
    this.txnId = details.txnId ?? null;
    this.retryable = details.retryable ?? null;
    this.upstreamError = details.upstreamError ?? null;
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
      operation: nullableString(userInfo?.operation),
      status: nullableNumber(userInfo?.status),
      txnId: nullableString(userInfo?.txnId),
      retryable: nullableBoolean(userInfo?.retryable),
      upstreamError: upstreamError(userInfo?.upstreamError),
    },
    error instanceof Error ? { cause: error } : undefined
  );
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value != null
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableString(value: unknown): string | null {
  return value == null ? null : stringValue(value);
}

function nullableNumber(value: unknown): number | null {
  return value == null || typeof value !== 'number' ? null : value;
}

function nullableBoolean(value: unknown): boolean | null {
  return value == null || typeof value !== 'boolean' ? null : value;
}

function upstreamError(value: unknown): OMSWalletUpstreamError | null {
  const item = record(value);
  if (item == null || (item.service !== 'waas' && item.service !== 'indexer')) {
    return null;
  }
  return {
    service: item.service,
    name: nullableString(item.name),
    code: nullableString(item.code),
    message: nullableString(item.message),
    status: nullableNumber(item.status),
  };
}
