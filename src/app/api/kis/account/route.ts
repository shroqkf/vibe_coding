import { NextResponse } from "next/server";
import { getAccountSummary } from "@/lib/kis/account";
import { toErrorResponseBody } from "@/lib/kis/errors";

export async function GET() {
  try {
    const summary = await getAccountSummary();
    return NextResponse.json(summary);
  } catch (err) {
    const body = toErrorResponseBody(err);
    return NextResponse.json(body, { status: body.status });
  }
}
