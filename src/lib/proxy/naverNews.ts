// k-skill-proxy(naver-news-search) 경유 네이버 뉴스 검색. API 키 발급 불필요.
const PROXY_BASE_URL = process.env.KSKILL_PROXY_BASE_URL ?? "https://k-skill-proxy.nomadamas.org";

export type NewsItem = {
  title: string;
  description: string;
  link: string;
  originalLink: string | null;
  pubDateIso: string | null;
};

type ProxyNewsResponse = {
  items: {
    title: string;
    description: string;
    link: string;
    original_link: string;
    pub_date_iso: string | null;
  }[];
};

type CacheEntry = { items: NewsItem[]; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 프록시 호출 남발 방지 (10분 캐시)

export async function searchNews(query: string, display = 8): Promise<NewsItem[]> {
  const cacheKey = `${query}:${display}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  const url = new URL("/v1/naver-news/search", PROXY_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("sort", "date");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    // 실패 시 재시도하지 않고, 이전 캐시가 있으면 그거라도 반환한다.
    if (cached) return cached.items;
    throw new Error(`뉴스 검색 프록시 오류 (HTTP ${res.status})`);
  }
  const data = (await res.json()) as ProxyNewsResponse;
  const items: NewsItem[] = (data.items ?? []).map((i) => ({
    title: i.title,
    description: i.description,
    link: i.link,
    originalLink: i.original_link || null,
    pubDateIso: i.pub_date_iso,
  }));

  cache.set(cacheKey, { items, fetchedAt: Date.now() });
  return items;
}
