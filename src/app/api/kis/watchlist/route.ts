import { NextRequest, NextResponse } from "next/server";
import { addToWatchlist, getWatchlist } from "@/lib/watchlist";

export async function GET() {
  const items = await getWatchlist();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { code?: string; name?: string };
  if (!body.code || !body.name) {
    return NextResponse.json({ error: "code, name은 필수입니다." }, { status: 400 });
  }
  const items = await addToWatchlist({ code: body.code, name: body.name });
  return NextResponse.json({ items });
}
