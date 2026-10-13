export type KisErrorCode =
  | "CREDENTIALS_MISSING"
  | "ACCOUNT_MISSING"
  | "NOT_PAPER_TRADING"
  | "TOKEN_EXPIRED"
  | "STOCK_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "INVALID_ORDER"
  | "UPSTREAM_NETWORK_ERROR"
  | "UNKNOWN";

const STATUS_BY_CODE: Record<KisErrorCode, number> = {
  CREDENTIALS_MISSING: 500,
  ACCOUNT_MISSING: 500,
  NOT_PAPER_TRADING: 500,
  TOKEN_EXPIRED: 401,
  STOCK_NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  INVALID_ORDER: 400,
  UPSTREAM_NETWORK_ERROR: 502,
  UNKNOWN: 500,
};

export class KisApiError extends Error {
  code: KisErrorCode;
  status: number;
  detail?: unknown;

  constructor(code: KisErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "KisApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.detail = detail;
  }
}

export function toErrorResponseBody(err: unknown) {
  if (err instanceof KisApiError) {
    return { error: err.message, code: err.code, status: err.status };
  }
  return {
    error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
    code: "UNKNOWN" as const,
    status: 500,
  };
}
