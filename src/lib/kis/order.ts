import { kisFetch } from "./http";
import { getKisAccount } from "./env";
import { KisApiError } from "./errors";
import { assertPaperTrading } from "./guard";

export type OrderSide = "buy" | "sell";
export type OrderPriceType = "market" | "limit";

export type PlaceOrderInput = {
  code: string;
  side: OrderSide;
  priceType: OrderPriceType;
  quantity: number;
  price?: number; // priceType === "limit"일 때 필수
};

export type OrderRecord = {
  orderNo: string; // ODNO
  orderBranchNo: string; // KRX_FWDG_ORD_ORGNO — 정정/취소 시 필요
  code: string;
  name: string;
  side: OrderSide;
  orderType: string; // 주문구분명
  quantity: number;
  price: number;
  filledQuantity: number;
  status: "filled" | "partial" | "open";
  orderTime: string;
};

function requireAccount() {
  const account = getKisAccount();
  if (!account) {
    throw new KisApiError(
      "ACCOUNT_MISSING",
      "KIS_ACCOUNT 환경변수(계좌번호-상품코드, 예: 12345678-01)가 설정되어 있지 않습니다."
    );
  }
  return account;
}

function validateOrder(input: PlaceOrderInput) {
  if (input.quantity <= 0) {
    throw new KisApiError("INVALID_ORDER", "주문 수량은 1 이상이어야 합니다.");
  }
  if (input.priceType === "limit" && (!input.price || input.price <= 0)) {
    throw new KisApiError("INVALID_ORDER", "지정가 주문은 가격을 입력해야 합니다.");
  }
}

// 주식주문(현금) 매수/매도. tr_id는 구현 시점에 공식 문서로 재대조 필요.
export async function placeOrder(
  input: PlaceOrderInput
): Promise<{ orderNo: string; orderBranchNo: string; orderTime: string }> {
  assertPaperTrading();
  validateOrder(input);
  const account = requireAccount();

  const trId = input.side === "buy" ? "VTTC0802U" : "VTTC0801U";

  const data = await kisFetch<{
    output: { KRX_FWDG_ORD_ORGNO: string; ODNO: string; ORD_TMD: string };
  }>("/uapi/domestic-stock/v1/trading/order-cash", {
    method: "POST",
    trId,
    body: {
      CANO: account.cano,
      ACNT_PRDT_CD: account.acntPrdtCd,
      PDNO: input.code,
      ORD_DVSN: input.priceType === "market" ? "01" : "00",
      ORD_QTY: String(input.quantity),
      ORD_UNPR: input.priceType === "market" ? "0" : String(input.price),
    },
  });

  return {
    orderNo: data.output.ODNO,
    orderBranchNo: data.output.KRX_FWDG_ORD_ORGNO,
    orderTime: data.output.ORD_TMD,
  };
}

export type ModifyCancelInput = {
  orderNo: string;
  orderBranchNo: string;
  action: "modify" | "cancel";
  quantity: number; // 정정/취소 수량 (전량이면 원주문 수량과 동일하게)
  price?: number; // 정정 시 새 가격, 시장가 정정이면 생략
  priceType?: OrderPriceType;
};

// 주식주문 정정취소. tr_id는 구현 시점에 공식 문서로 재대조 필요.
export async function modifyOrCancelOrder(input: ModifyCancelInput): Promise<void> {
  assertPaperTrading();
  const account = requireAccount();

  await kisFetch("/uapi/domestic-stock/v1/trading/order-rvsecncl", {
    method: "POST",
    trId: "VTTC0803U",
    body: {
      CANO: account.cano,
      ACNT_PRDT_CD: account.acntPrdtCd,
      KRX_FWDG_ORD_ORGNO: input.orderBranchNo,
      ORGN_ODNO: input.orderNo,
      ORD_DVSN: input.priceType === "market" ? "01" : "00",
      RVSE_CNCL_DVSN_CD: input.action === "modify" ? "01" : "02",
      ORD_QTY: String(input.quantity),
      ORD_UNPR: input.action === "cancel" ? "0" : String(input.price ?? 0),
      QTY_ALL_ORD_YN: "Y",
    },
  });
}

type DailyOrderOutput = {
  odno: string;
  ord_gno_brno: string; // 주문채번지점번호 — 정정/취소 시 KRX_FWDG_ORD_ORGNO로 그대로 사용
  pdno: string;
  prdt_name: string;
  sll_buy_dvsn_cd_name: string;
  ord_dvsn_name: string;
  ord_qty: string;
  ord_unpr: string;
  tot_ccld_qty: string;
  ord_tmd: string;
  rmn_qty: string; // 잔여수량(미체결)
};

// 당일 주문내역 조회. tr_id는 구현 시점에 공식 문서로 재대조 필요.
export async function getTodayOrders(): Promise<OrderRecord[]> {
  const account = requireAccount();

  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const data = await kisFetch<{ output1: DailyOrderOutput[] }>(
    "/uapi/domestic-stock/v1/trading/inquire-daily-ccld",
    {
      trId: "VTTC8001R",
      query: {
        CANO: account.cano,
        ACNT_PRDT_CD: account.acntPrdtCd,
        INQR_STRT_DT: dateStr,
        INQR_END_DT: dateStr,
        SLL_BUY_DVSN_CD: "00",
        INQR_DVSN: "00",
        PDNO: "",
        CCLD_DVSN: "00",
        ORD_GNO_BRNO: "",
        ODNO: "",
        INQR_DVSN_3: "00",
        INQR_DVSN_1: "",
        CTX_AREA_FK100: "",
        CTX_AREA_NK100: "",
      },
    }
  );

  return (data.output1 ?? []).map((o) => {
    const ordQty = Number(o.ord_qty);
    const filledQty = Number(o.tot_ccld_qty);
    const remaining = Number(o.rmn_qty);
    return {
      orderNo: o.odno,
      orderBranchNo: o.ord_gno_brno,
      code: o.pdno,
      name: o.prdt_name,
      side: o.sll_buy_dvsn_cd_name.includes("매수") ? "buy" : "sell",
      orderType: o.ord_dvsn_name,
      quantity: ordQty,
      price: Number(o.ord_unpr),
      filledQuantity: filledQty,
      status: remaining === 0 ? "filled" : filledQty > 0 ? "partial" : "open",
      orderTime: o.ord_tmd,
    };
  });
}
