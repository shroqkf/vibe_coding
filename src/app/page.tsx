"use client";

import { useEffect, useState } from "react";
import StockListCard from "@/components/StockListCard";
import { changeColorClass, formatKrw, formatPercent, formatSigned } from "@/lib/format";
import type { StockQuote } from "@/lib/kis/quote";
import type { IndexQuote } from "@/lib/kis/indices";
import type { AccountSummary } from "@/lib/kis/account";
import { POPULAR_STOCKS } from "@/lib/kis/popularStocks";

type NewsItem = {
  title: string;
  description: string;
  link: string;
  originalLink: string | null;
  pubDateIso: string | null;
};

type WatchlistItem = { code: string; name: string };

const POLL_MS = 5000;

export default function Home() {
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [popularQuotes, setPopularQuotes] = useState<StockQuote[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<StockQuote[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);

  useEffect(() => {
    fetch("/api/kis/watchlist")
      .then((r) => r.json())
      .then((d) => setWatchlist(d.items ?? []));

    fetch("/api/news?q=코스피 증시")
      .then((r) => r.json())
      .then((d) => setNews(d.items ?? []));

    fetch("/api/kis/account")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setAccountError(d.error ?? "계좌 정보를 불러오지 못했습니다.");
          return;
        }
        setAccount(d as AccountSummary);
      })
      .catch(() => setAccountError("계좌 정보를 불러오지 못했습니다."));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function pollIndices() {
      try {
        const res = await fetch("/api/kis/indices");
        const data = await res.json();
        if (!cancelled && res.ok) setIndices(data.indices ?? []);
      } catch {
        // 폴링 중 일시적 오류는 조용히 무시하고 다음 주기에 재시도
      }
    }
    pollIndices();
    const id = setInterval(pollIndices, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function pollPopular() {
      try {
        const codes = POPULAR_STOCKS.map((s) => s.code).join(",");
        const names = POPULAR_STOCKS.map((s) => s.name).join(",");
        const res = await fetch(
          `/api/kis/stocks/quotes?codes=${codes}&names=${encodeURIComponent(names)}`
        );
        const data = await res.json();
        if (!cancelled && res.ok) setPopularQuotes(data.quotes ?? []);
      } finally {
        if (!cancelled) setLoadingPopular(false);
      }
    }
    pollPopular();
    const id = setInterval(pollPopular, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (watchlist.length === 0) {
      setWatchlistQuotes([]);
      setLoadingWatchlist(false);
      return;
    }
    let cancelled = false;
    async function pollWatchlist() {
      try {
        const codes = watchlist.map((w) => w.code).join(",");
        const names = watchlist.map((w) => w.name).join(",");
        const res = await fetch(
          `/api/kis/stocks/quotes?codes=${codes}&names=${encodeURIComponent(names)}`
        );
        const data = await res.json();
        if (!cancelled && res.ok) setWatchlistQuotes(data.quotes ?? []);
      } finally {
        if (!cancelled) setLoadingWatchlist(false);
      }
    }
    pollWatchlist();
    const id = setInterval(pollWatchlist, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [watchlist]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* 지수 티커 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        {(indices.length > 0 ? indices : [{ code: "0001", name: "코스피", price: 0, change: 0, changeRate: 0 }, { code: "1001", name: "코스닥", price: 0, change: 0, changeRate: 0 }]).map(
          (idx) => (
            <div
              key={idx.code}
              className="rounded-2xl border border-toss-gray-200 bg-white p-4 shadow-toss"
            >
              <p className="text-xs font-semibold text-toss-gray-500">{idx.name}</p>
              <p className="mt-1 text-xl font-bold text-toss-gray-900">
                {idx.price > 0 ? idx.price.toLocaleString("ko-KR") : "—"}
              </p>
              {idx.price > 0 && (
                <p className={`text-xs font-semibold ${changeColorClass(idx.change)}`}>
                  {formatSigned(idx.change)} ({formatPercent(idx.changeRate)})
                </p>
              )}
            </div>
          )
        )}
      </div>

      {/* 계좌 요약 */}
      <section className="mt-4 rounded-3xl bg-gradient-to-br from-toss-blue to-toss-blue-dark p-6 text-white shadow-toss-lg sm:p-8">
        <p className="text-sm font-semibold text-blue-100">모의투자 계좌 요약</p>
        {accountError ? (
          <p className="mt-3 text-sm text-blue-100">
            {accountError}
            {accountError.includes("KIS_ACCOUNT") && (
              <>
                {" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5">.env</code>에{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5">
                  KIS_ACCOUNT=계좌번호-상품코드
                </code>
                를 추가해 주세요.
              </>
            )}
          </p>
        ) : account ? (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-blue-100">예수금</p>
              <p className="mt-1 text-lg font-bold">{formatKrw(account.depositCash)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-100">총평가금액</p>
              <p className="mt-1 text-lg font-bold">{formatKrw(account.totalEvalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-100">평가손익</p>
              <p className="mt-1 text-lg font-bold">{formatSigned(account.totalProfitLoss)}원</p>
            </div>
            <div>
              <p className="text-xs text-blue-100">수익률</p>
              <p className="mt-1 text-lg font-bold">
                {formatPercent(account.totalProfitLossRate)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-blue-100">불러오는 중...</p>
        )}
      </section>

      {/* 랭킹 */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StockListCard title="인기 종목" quotes={popularQuotes} loading={loadingPopular} />
        <StockListCard
          title="관심 종목"
          quotes={watchlistQuotes}
          loading={loadingWatchlist}
          emptyMessage="종목 조회에서 관심종목을 추가해 보세요."
        />
      </section>

      {/* 뉴스 */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-toss-gray-900">주요 뉴스</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {news.length === 0 && (
            <p className="text-sm text-toss-gray-400">뉴스를 불러오는 중...</p>
          )}
          {news.map((n) => (
            <a
              key={n.link}
              href={n.originalLink ?? n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-toss-gray-200 bg-white p-4 shadow-toss transition hover:-translate-y-0.5 hover:shadow-toss-lg"
            >
              <p className="text-sm font-semibold text-toss-gray-900 line-clamp-2">
                {n.title}
              </p>
              <p className="mt-1.5 text-xs text-toss-gray-500 line-clamp-2">
                {n.description}
              </p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
