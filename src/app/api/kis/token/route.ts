import { NextResponse } from "next/server";

// 한국투자증권(KIS) Open API OAuth2 접근토큰 발급
// 문서: https://apiportal.koreainvestment.com (오른쪽 상단 API 문서 > OAuth 인증 > 접근토큰발급(P))
//
// 실전투자: https://openapi.koreainvestment.com:9443
// 모의투자: https://openapivts.koreainvestment.com:29443
// .env에 KIS_BASE_URL을 지정하지 않으면 실전투자 도메인을 기본값으로 사용합니다.
const KIS_BASE_URL =
  process.env.KIS_BASE_URL ?? "https://openapi.koreainvestment.com:9443";

type CachedToken = {
  accessToken: string;
  tokenType: string;
  expiresAt: number; // epoch ms
};

// 서버 프로세스 메모리 내 캐시.
// KIS는 접근토큰 재발급에 횟수 제한을 두고 있으므로, 만료 전에는 새로 발급받지 않고
// 캐시된 토큰을 재사용합니다. (서버 재시작 시 캐시는 초기화됩니다.)
let cached: CachedToken | null = null;

export async function POST() {
  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!appKey || !appSecret) {
    return NextResponse.json(
      {
        error:
          "KIS_APP_KEY / KIS_APP_SECRET 환경변수가 설정되어 있지 않습니다. 저장소 루트의 .env 파일을 확인하세요.",
      },
      { status: 500 }
    );
  }

  // 유효기간이 60초 이상 남은 캐시가 있으면 그대로 재사용합니다.
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return NextResponse.json({
      access_token: cached.accessToken,
      token_type: cached.tokenType,
      expires_at: new Date(cached.expiresAt).toISOString(),
      cached: true,
    });
  }

  try {
    const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: appKey,
        appsecret: appSecret,
      }),
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      return NextResponse.json(
        {
          error:
            data.error_description ?? data.msg1 ?? "토큰 발급에 실패했습니다.",
          raw: data,
        },
        { status: res.status || 500 }
      );
    }

    const expiresInSec = Number(data.expires_in ?? 86400);
    const expiresAt = Date.now() + expiresInSec * 1000;

    cached = {
      accessToken: data.access_token as string,
      tokenType: (data.token_type as string) ?? "Bearer",
      expiresAt,
    };

    return NextResponse.json({
      access_token: cached.accessToken,
      token_type: cached.tokenType,
      expires_at: new Date(expiresAt).toISOString(),
      cached: false,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
