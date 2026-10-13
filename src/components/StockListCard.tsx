"use client";

import Link from "next/link";
import { changeColorClass, formatPercent, formatSigned } from "@/lib/format";
import type { StockQuote } from "@/lib/kis/quote";

type Props = {
  title: string;
  quotes: StockQuote[];
  loading: boolean;
  emptyMessage?: string;
};

export default function StockListCard({ title, quotes, loading, emptyMessage }: Props) {
  return (
    <div className="rounded-2xl border border-toss-gray-200 bg-white p-5 shadow-toss">
      <h3 className="text-base font-bold text-toss-gray-900">{title}</h3>
      <div className="mt-3 divide-y divide-toss-gray-100">
        {loading && (
          <div className="py-6 text-center text-sm text-toss-gray-400">불러오는 중...</div>
        )}
        {!loading && quotes.length === 0 && (
          <div className="py-6 text-center text-sm text-toss-gray-400">
            {emptyMessage ?? "표시할 종목이 없어요."}
          </div>
        )}
        {!loading &&
          quotes.map((q, i) => (
            <Link
              key={q.code}
              href={`/quote?code=${q.code}&name=${encodeURIComponent(q.name)}`}
              className="flex items-center justify-between py-3 transition hover:bg-toss-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-toss-gray-100 text-xs font-bold text-toss-gray-500">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-toss-gray-900">{q.name}</p>
                  <p className="text-xs text-toss-gray-400">{q.code}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-toss-gray-900">
                  {q.price.toLocaleString("ko-KR")}원
                </p>
                <p className={`text-xs font-semibold ${changeColorClass(q.change)}`}>
                  {formatSigned(q.change)} ({formatPercent(q.changeRate)})
                </p>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
