import { NextRequest, NextResponse } from "next/server";
import { getTodayOrders, placeOrder, type OrderPriceType, type OrderSide } from "@/lib/kis/order";
import { toErrorResponseBody } from "@/lib/kis/errors";

export async function GET() {
  try {
    const orders = await getTodayOrders();
    return NextResponse.json({ orders });
  } catch (err) {
    const body = toErrorResponseBody(err);
    return NextResponse.json(body, { status: body.status });
  }
}

type PlaceOrderBody = {
  code: string;
  side: OrderSide;
  priceType: OrderPriceType;
  quantity: number;
  price?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlaceOrderBody;
    if (!body.code || !body.side || !body.priceType || !body.quantity) {
      return NextResponse.json(
        { error: "code, side, priceType, quantity는 필수입니다.", code: "INVALID_ORDER" },
        { status: 400 }
      );
    }
    const result = await placeOrder(body);
    return NextResponse.json(result);
  } catch (err) {
    const errBody = toErrorResponseBody(err);
    return NextResponse.json(errBody, { status: errBody.status });
  }
}
