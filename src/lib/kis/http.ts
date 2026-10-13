import { getKisBaseUrl, getKisCredentials } from "./env";
import { getAccessToken } from "./token";
import { KisApiError } from "./errors";

type KisFetchOptions = {
  method?: "GET" | "POST";
  trId: string;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
  // 모의투자 정정/취소 등 일부 TR은 tr_cont, custtype 외에 추가 헤더가 필요 없다.
  // 필요해지면 여기에 확장한다.
};

// KIS REST API 공통 호출 헬퍼. 인증 헤더 구성 + 에러 정규화를 담당한다.
export async function kisFetch<T = unknown>(
  path: string,
  opts: KisFetchOptions
): Promise<T> {
  const creds = getKisCredentials();
  if (!creds) {
    throw new KisApiError(
      "CREDENTIALS_MISSING",
      "KIS_APP_KEY / KIS_APP_SECRET 환경변수가 설정되어 있지 않습니다."
    );
  }

  const token = await getAccessToken();

  const url = new URL(path, getKisBaseUrl());
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    authorization: `Bearer ${token.accessToken}`,
    appkey: creds.appKey,
    appsecret: creds.appSecret,
    tr_id: opts.trId,
    custtype: "P",
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    throw new KisApiError(
      "UPSTREAM_NETWORK_ERROR",
      err instanceof Error ? err.message : "KIS 서버 연결에 실패했습니다."
    );
  }

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    throw new KisApiError(
      "UPSTREAM_NETWORK_ERROR",
      (data.msg1 as string) ?? `KIS 서버 오류 (HTTP ${res.status})`,
      data
    );
  }

  // KIS REST 응답은 HTTP 200이어도 rt_cd로 성공/실패를 구분한다. rt_cd !== "0"이면 실패.
  if ("rt_cd" in data && data.rt_cd !== "0") {
    throw new KisApiError(
      "INVALID_ORDER",
      (data.msg1 as string) ?? "요청이 거부되었습니다.",
      data
    );
  }

  return data as T;
}
