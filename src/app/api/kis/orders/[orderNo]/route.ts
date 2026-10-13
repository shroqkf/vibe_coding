import { NextRequest, NextResponse } from "next/server";
import { modifyOrCancelOrder, type OrderPriceType } from "@/lib/kis/order";
import { toErrorResponseBody } from "@/lib/kis/errors";

type Body = {
  orderBranchNo: string;
  quantity: number;
  price?: number;
  priceType?: OrderPriceType;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  const { orderNo } = await params;
  try {
    const body = (await req.json()) as Body;
    await modifyOrCancelOrder({ orderNo, action: "modify", ...body });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const errBody = toErrorResponseBody(err);
    return NextResponse.json(errBody, { status: errBody.status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  const { orderNo } = await params;
  try {
    const body = (await req.json()) as Body;
    await modifyOrCancelOrder({ orderNo, action: "cancel", ...body });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const errBody = toErrorResponseBody(err);
    return NextResponse.json(errBody, { status: errBody.status });
  }
}
