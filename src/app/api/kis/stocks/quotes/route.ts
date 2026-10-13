import { NextRequest, NextResponse } from "next/server";
import { getStockQuotes } from "@/lib/kis/quote";

// 홈 화면의 인기/관심종목 카드처럼 여러 종목의 현재가를 한 번에 조회할 때 사용.
// names는 codes와 같은 순서로 콤마 구분 (종목명 필드가 없는 TR 응답을 보완).
export async function GET(req: NextRequest) {
  const codesParam = req.nextUrl.searchParams.get("codes");
  const namesParam = req.nextUrl.searchParams.get("names");
  const codes = codesParam ? codesParam.split(",").filter(Boolean) : [];
  const names = namesParam ? namesParam.split(",") : [];
  if (codes.length === 0) {
    return NextResponse.json({ quotes: [] });
  }
  const quotes = await getStockQuotes(codes.map((code, i) => ({ code, name: names[i] })));
  return NextResponse.json({ quotes });
}
