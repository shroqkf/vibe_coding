"use client";

import { useState } from "react";

type TokenStatus = {
  status: "issued";
  token_type: string;
  expires_at: string;
  cached: boolean;
};

export default function TokenPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TokenStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function issueToken() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kis/token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "토큰 발급에 실패했습니다.");
        setResult(null);
      } else {
        setResult(data as TokenStatus);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-toss-gray-900">토큰 상태</h1>
      <p className="mt-2 text-sm leading-relaxed text-toss-gray-500">
        한국투자증권 Open API 접근토큰 발급 상태를 확인합니다. 토큰 값 자체는 서버 밖으로
        노출되지 않습니다.
      </p>

      <div className="mt-6 rounded-2xl border border-toss-gray-200 bg-white p-6 shadow-toss">
        <button
          onClick={issueToken}
          disabled={loading}
          className="w-full rounded-2xl bg-toss-blue py-4 text-[15px] font-bold text-white transition hover:bg-toss-blue-dark disabled:cursor-not-allowed disabled:bg-toss-gray-300"
        >
          {loading ? "확인 중..." : "토큰 발급/상태 확인"}
        </button>

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-toss-red">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-5 space-y-2 rounded-2xl bg-toss-gray-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-toss-gray-500">상태</span>
              <span className="font-semibold text-toss-gray-900">
                발급됨 {result.cached && "(캐시됨)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-toss-gray-500">token_type</span>
              <span className="font-semibold text-toss-gray-900">{result.token_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-toss-gray-500">만료</span>
              <span className="font-semibold text-toss-gray-900">
                {new Date(result.expires_at).toLocaleString("ko-KR")}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
