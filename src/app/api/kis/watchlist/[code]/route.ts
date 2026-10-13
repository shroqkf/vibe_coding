import { NextResponse } from "next/server";
import { removeFromWatchlist } from "@/lib/watchlist";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const items = await removeFromWatchlist(code);
  return NextResponse.json({ items });
}
