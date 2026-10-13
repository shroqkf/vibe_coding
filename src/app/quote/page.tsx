"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import OrderDialog from "@/components/OrderDialog";
import { changeColorClass, formatPercent, formatSigned } from "@/lib/format";
import type { StockQuote } from "@/lib/kis/quote";

type SearchResult = { market: string; code: string; name: string };

const POLL_MS = 3000;

function QuotePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code");
  const initialName = searchParams.get("name");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL의 ?code=로 진입한 경우 바로 조회
  useEffect(() => {
    if (initialCode) {
      setSelected({ market: "", code: initialCode, name: initialName ?? initialCode });
    }
  }, [initialCode, initialName]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/kis/stocks/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    async function checkWatchlist(code: string) {
      const res = await fetch("/api/kis/watchlist");
      const data = await res.json();
      setInWatchlist((data.items ?? []).some((i: { code: string }) => i.code === code));
    }
    if (selected) checkWatchlist(selected.code);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    async function pollQuote() {
      try {
        const nameParam =
          selected!.name && selected!.name !== selected!.code
            ? `?name=${encodeURIComponent(selected!.name)}`
            : "";
        const res = await fetch(`/api/kis/stocks/${selected!.code}${nameParam}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setQuoteError(data.error ?? "시세를 불러오지 못했습니다.");
          setQuote(null);
          return;
        }
        setQuoteError(null);
        setQuote(data.quote);
      } catch {
        if (!cancelled) setQuoteError("네트워크 오류가 발생했습니다.");
      }
    }
    pollQuote();
    const id = setInterval(pollQuote, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selected]);

  function selectStock(r: SearchResult) {
    setSelected(r);
    setResults([]);
    setQuery("");
    router.replace(`/quote?code=${r.code}&name=${encodeURIComponent(r.name)}`);
  }

  async function toggleWatchlist() {
    if (!selected || !quote) return;
    if (inWatchlist) {
      await fetch(`/api/kis/watchlist/${selected.code}`, { method: "DELETE" });
      setInWatchlist(false);
    } else {
      await fetch("/api/kis/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: selected.code, name: quote.name }),
      });
      setInWatchlist(true);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-toss-gray-900">종목 조회</h1>

      <div className="relative mt-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목명 또는 종목코드 검색 (예: 삼성전자, 005930)"
          className="w-full rounded-2xl border border-toss-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-toss-gray-900 outline-none focus:border-toss-blue"
        />
        {(results.length > 0 || searching) && (
          <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-toss-gray-200 bg-white shadow-toss-lg">
            {searching && (
              <div className="px-4 py-3 text-sm text-toss-gray-400">검색 중...</div>
            )}
            {!searching &&
              results.map((r) => (
                <button
                  key={r.code}
                  onClick={() => selectStock(r)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-toss-gray-50"
                >
                  <span className="font-semibold text-toss-gray-900">{r.name}</span>
                  <span className="text-xs text-toss-gray-400">
                    {r.market} · {r.code}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="mt-6 rounded-2xl border border-toss-gray-200 bg-white p-6 shadow-toss">
          {quoteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-toss-red">
              {quoteError}
            </div>
          )}

          {quote && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-toss-gray-900">{quote.name}</h2>
                  <p className="text-sm text-toss-gray-400">{quote.code}</p>
                </div>
                <button
                  onClick={toggleWatchlist}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    inWatchlist
                      ? "bg-toss-blue-light text-toss-blue"
                      : "bg-toss-gray-100 text-toss-gray-500"
                  }`}
                >
                  {inWatchlist ? "관심종목 ✓" : "관심종목 추가"}
                </button>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-toss-gray-900">
                  {quote.price.toLocaleString("ko-KR")}원
                </span>
                <span className={`text-sm font-semibold ${changeColorClass(quote.change)}`}>
                  {formatSigned(quote.change)} ({formatPercent(quote.changeRate)})
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-xl bg-toss-gray-50 py-3">
                  <p className="text-xs text-toss-gray-400">시가</p>
                  <p className="mt-1 font-semibold text-toss-gray-900">
                    {quote.open.toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="rounded-xl bg-toss-gray-50 py-3">
                  <p className="text-xs text-toss-gray-400">고가</p>
                  <p className="mt-1 font-semibold text-toss-gray-900">
                    {quote.high.toLocaleString("ko-KR")}
                  </p>
                </div>
                <div className="rounded-xl bg-toss-gray-50 py-3">
                  <p className="text-xs text-toss-gray-400">저가</p>
                  <p className="mt-1 font-semibold text-toss-gray-900">
                    {quote.low.toLocaleString("ko-KR")}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-toss-gray-400">
                누적 거래량 {quote.volume.toLocaleString("ko-KR")}주 · {POLL_MS / 1000}초마다
                갱신
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setOrderSide("buy");
                    setOrderOpen(true);
                  }}
                  className="rounded-2xl bg-toss-red py-4 text-[15px] font-bold text-white transition hover:opacity-90"
                >
                  매수
                </button>
                <button
                  onClick={() => {
                    setOrderSide("sell");
                    setOrderOpen(true);
                  }}
                  className="rounded-2xl bg-toss-blue py-4 text-[15px] font-bold text-white transition hover:bg-toss-blue-dark"
                >
                  매도
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {orderOpen && quote && selected && (
        <OrderDialog
          code={selected.code}
          name={quote.name}
          currentPrice={quote.price}
          initialSide={orderSide}
          onClose={() => setOrderOpen(false)}
          onOrdered={() => {
            setOrderOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default function QuotePage() {
  return (
    <Suspense fallback={null}>
      <QuotePageInner />
    </Suspense>
  );
}
