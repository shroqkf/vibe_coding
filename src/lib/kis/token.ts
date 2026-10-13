import { getKisBaseUrl, getKisCredentials } from "./env";
import { KisApiError } from "./errors";

type CachedToken = {
  accessToken: string;
  tokenType: string;
  expiresAt: number; // epoch ms
};

// 서버 프로세스 메모리 내 캐시.
// KIS는 접근토큰 재발급에 횟수 제한을 두고 있으므로, 만료 전에는 새로 발급받지 않고
// 캐시된 토큰을 재사용한다. (서버 재시작 시 캐시는 초기화된다.)
let cached: CachedToken | null = null;
// 동시에 여러 요청이 캐시 미스를 만나면 KIS 토큰 발급(분당 1회 제한)에 동시에 부딪힌다.
// 진행 중인 발급 요청을 공유해서 중복 호출을 막는다.
let inFlight: Promise<CachedToken> | null = null;
// 발급 실패 직후 짧은 간격으로 재시도하면(예: 5초 폴링) 매번 KIS의 "분당 1회" 제한에
// 다시 걸려 영영 복구되지 않는다. 실패 후 일정 시간 동안은 재시도하지 않고 같은 에러를
// 즉시 반환해, 다음 실제 시도가 분당 제한 윈도우 밖에서 이뤄지도록 한다.
let lastFailure: { error: KisApiError; at: number } | null = null;
const FAILURE_COOLDOWN_MS = 65_000;

export function getTokenStatus() {
  if (!cached) return { status: "none" as const };
  const remainingMs = cached.expiresAt - Date.now();
  if (remainingMs <= 0) return { status: "none" as const };
  return {
    status: "issued" as const,
    expiresAt: new Date(cached.expiresAt).toISOString(),
    remainingMs,
  };
}

// 만료 60초 이상 남았으면 캐시 재사용, 아니면 재발급한다.
// access_token 원문은 이 함수를 호출하는 서버 코드 밖으로 절대 내보내지 않는다.
export async function getAccessToken(): Promise<{
  accessToken: string;
  tokenType: string;
  expiresAt: number;
  cached: boolean;
}> {
  const creds = getKisCredentials();
  if (!creds) {
    throw new KisApiError(
      "CREDENTIALS_MISSING",
      "KIS_APP_KEY / KIS_APP_SECRET 환경변수가 설정되어 있지 않습니다. 저장소 루트의 .env 파일을 확인하세요."
    );
  }

  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return { ...cached, cached: true };
  }

  if (inFlight) {
    const token = await inFlight;
    return { ...token, cached: true };
  }

  if (lastFailure && Date.now() - lastFailure.at < FAILURE_COOLDOWN_MS) {
    throw lastFailure.error;
  }

  inFlight = (async () => {
    let res: Response;
    try {
      res = await fetch(`${getKisBaseUrl()}/oauth2/tokenP`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: creds.appKey,
          appsecret: creds.appSecret,
        }),
        cache: "no-store",
      });
    } catch (err) {
      throw new KisApiError(
        "UPSTREAM_NETWORK_ERROR",
        err instanceof Error ? err.message : "KIS 서버 연결에 실패했습니다."
      );
    }

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      throw new KisApiError(
        "TOKEN_EXPIRED",
        data.error_description ?? data.msg1 ?? "토큰 발급에 실패했습니다.",
        data
      );
    }

    const expiresInSec = Number(data.expires_in ?? 86400);
    const expiresAt = Date.now() + expiresInSec * 1000;

    cached = {
      accessToken: data.access_token as string,
      tokenType: (data.token_type as string) ?? "Bearer",
      expiresAt,
    };
    return cached;
  })();

  try {
    const token = await inFlight;
    lastFailure = null;
    return { ...token, cached: false };
  } catch (err) {
    lastFailure = {
      error:
        err instanceof KisApiError
          ? err
          : new KisApiError("UNKNOWN", err instanceof Error ? err.message : "알 수 없는 오류"),
      at: Date.now(),
    };
    throw err;
  } finally {
    inFlight = null;
  }
}
