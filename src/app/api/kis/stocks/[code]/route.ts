import { NextResponse } from "next/server";
import { getStockQuote } from "@/lib/kis/quote";
import { toErrorResponseBody } from "@/lib/kis/errors";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const name = new URL(req.url).searchParams.get("name") ?? undefined;
  try {
    const quote = await getStockQuote(code, name);
    return NextResponse.json({ quote });
  } catch (err) {
    const body = toErrorResponseBody(err);
    return NextResponse.json(body, { status: body.status });
  }
}
