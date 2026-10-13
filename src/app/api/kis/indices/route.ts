import { NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/kis/indices";
import { toErrorResponseBody } from "@/lib/kis/errors";

export async function GET() {
  try {
    const indices = await getMarketIndices();
    return NextResponse.json({ indices });
  } catch (err) {
    const body = toErrorResponseBody(err);
    return NextResponse.json(body, { status: body.status });
  }
}
