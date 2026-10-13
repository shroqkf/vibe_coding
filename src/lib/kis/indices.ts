import { kisFetch } from "./http";

export type IndexQuote = {
  code: string;
  name: string;
  price: number;
  change: number;
  changeRate: number;
};

const INDEX_CODES: { code: string; name: string }[] = [
  { code: "0001", name: "코스피" },
  { code: "1001", name: "코스닥" },
];

type InquireIndexOutput = {
  bstp_nmix_prpr: string; // 업종 지수 현재가
  bstp_nmix_prdy_vrss: string; // 전일 대비
  bstp_nmix_prdy_ctrt: string; // 전일 대비율
};

// 업종(지수) 현재가 시세조회. tr_id는 구현 시점에 공식 문서로 재대조 필요.
async function getIndexQuote(index: { code: string; name: string }): Promise<IndexQuote> {
  const data = await kisFetch<{ output: InquireIndexOutput }>(
    "/uapi/domestic-stock/v1/quotations/inquire-index-price",
    {
      trId: "FHPUP02100000",
      query: { FID_COND_MRKT_DIV_CODE: "U", FID_INPUT_ISCD: index.code },
    }
  );
  const o = data.output;
  return {
    code: index.code,
    name: index.name,
    price: Number(o.bstp_nmix_prpr),
    change: Number(o.bstp_nmix_prdy_vrss),
    changeRate: Number(o.bstp_nmix_prdy_ctrt),
  };
}

export async function getMarketIndices(): Promise<IndexQuote[]> {
  const results = await Promise.allSettled(INDEX_CODES.map(getIndexQuote));
  for (const r of results) {
    if (r.status === "rejected") console.error("[indices]", r.reason);
  }
  return results
    .filter((r): r is PromiseFulfilledResult<IndexQuote> => r.status === "fulfilled")
    .map((r) => r.value);
}
