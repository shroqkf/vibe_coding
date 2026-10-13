import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/kis/token";
import { toErrorResponseBody } from "@/lib/kis/errors";

// 한국투자증권(KIS) Open API OAuth2 접근토큰 발급.
// 토큰 문자열 자체는 이 라우트 밖으로 절대 노출하지 않는다 — 상태만 반환한다.

export async function POST() {
  try {
    const token = await getAccessToken();
    return NextResponse.json({
      status: "issued",
      token_type: token.tokenType,
      expires_at: new Date(token.expiresAt).toISOString(),
      cached: token.cached,
    });
  } catch (err) {
    const body = toErrorResponseBody(err);
    return NextResponse.json(body, { status: body.status });
  }
}
