// k-skill-proxy(korean-stock-search) 경유 종목 검색.
// KRX_API_KEY 발급/보관 없이 공개 프록시로 이름/코드 검색만 수행한다 (시세는 다루지 않음 — 시세는 KIS API 사용).
const PROXY_BASE_URL = process.env.KSKILL_PROXY_BASE_URL ?? "https://k-skill-proxy.nomadamas.org";

export type StockSearchResult = {
  market: "KOSPI" | "KOSDAQ" | "KONEX";
  code: string;
  name: string;
};

type ProxySearchResponse = {
  items: { market: string; code: string; name: string; short_name?: string }[];
};

function kstDateOffset(daysAgo: number): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - daysAgo * 86_400_000);
  return `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, "0")}${String(
    kst.getUTCDate()
  ).padStart(2, "0")}`;
}

async function fetchSearch(query: string, basDd: string): Promise<StockSearchResult[]> {
  const url = new URL("/v1/korean-stock/search", PROXY_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("bas_dd", basDd);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`종목 검색 프록시 오류 (HTTP ${res.status})`);
  }
  const data = (await res.json()) as ProxySearchResponse;
  return (data.items ?? []).map((i) => ({
    market: i.market as StockSearchResult["market"],
    code: i.code,
    name: i.short_name || i.name,
  }));
}

// 당일 기준일 데이터가 아직 없을 수 있어(장중 갱신 지연, 휴장일 등) 최근 영업일까지
// 최대 7일 전으로 거슬러 올라가며 재시도한다.
export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  for (let daysAgo = 0; daysAgo <= 7; daysAgo++) {
    const results = await fetchSearch(query, kstDateOffset(daysAgo));
    if (results.length > 0) return results;
  }
  return [];
}
