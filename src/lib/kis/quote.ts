import { kisFetch } from "./http";
import { KisApiError } from "./errors";

export type StockQuote = {
  code: string;
  name: string;
  price: number;
  change: number;
  changeRate: number;
  volume: number;
  open: number;
  high: number;
  low: number;
};

type InquirePriceOutput = {
  stck_prpr: string; // 현재가
  prdy_vrss: string; // 전일 대비
  prdy_ctrt: string; // 전일 대비율
  acml_vol: string; // 누적 거래량
  stck_oprc: string; // 시가
  stck_hgpr: string; // 최고가
  stck_lwpr: string; // 최저가
  hts_kor_isnm: string; // 종목명
};

// 주식현재가 시세조회(FHKST01010100)의 output에는 종목명 필드가 없다 — 이름은
// 검색/관심종목/인기종목 등 이미 이름을 알고 있는 호출부에서 넘겨받는다.
// tr_id는 구현 시점에 공식 문서로 재대조 필요.
export async function getStockQuote(code: string, knownName?: string): Promise<StockQuote> {
  try {
    const data = await kisFetch<{ output: InquirePriceOutput }>(
      "/uapi/domestic-stock/v1/quotations/inquire-price",
      {
        trId: "FHKST01010100",
        query: { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: code },
      }
    );

    const o = data.output;
    if (!o || !o.stck_prpr) {
      throw new KisApiError("STOCK_NOT_FOUND", `종목을 찾을 수 없습니다: ${code}`);
    }

    return {
      code,
      name: knownName ?? o.hts_kor_isnm ?? code,
      price: Number(o.stck_prpr),
      change: Number(o.prdy_vrss),
      changeRate: Number(o.prdy_ctrt),
      volume: Number(o.acml_vol),
      open: Number(o.stck_oprc),
      high: Number(o.stck_hgpr),
      low: Number(o.stck_lwpr),
    };
  } catch (err) {
    if (err instanceof KisApiError && err.code === "INVALID_ORDER") {
      // rt_cd !== 0인 경우 대개 잘못된 종목코드
      throw new KisApiError("STOCK_NOT_FOUND", `종목을 찾을 수 없습니다: ${code}`, err.detail);
    }
    throw err;
  }
}

export async function getStockQuotes(
  items: { code: string; name?: string }[]
): Promise<StockQuote[]> {
  const results = await Promise.allSettled(
    items.map((i) => getStockQuote(i.code, i.name))
  );
  for (const r of results) {
    if (r.status === "rejected") console.error("[quotes]", r.reason);
  }
  return results
    .filter((r): r is PromiseFulfilledResult<StockQuote> => r.status === "fulfilled")
    .map((r) => r.value);
}
