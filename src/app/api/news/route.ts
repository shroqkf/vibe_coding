import { NextRequest, NextResponse } from "next/server";
import { searchNews } from "@/lib/proxy/naverNews";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "코스피 증시";
  try {
    const items = await searchNews(q);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "뉴스를 불러오지 못했습니다." },
      { status: 502 }
    );
  }
}
