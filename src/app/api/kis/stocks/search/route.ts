import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/proxy/koreanStockSearch";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchStocks(q);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "검색 중 오류가 발생했습니다." },
      { status: 502 }
    );
  }
}
