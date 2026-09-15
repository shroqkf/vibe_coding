"use client";

import { useState } from "react";

type TokenResult = {
  access_token: string;
  token_type: string;
  expires_at: string;
  cached: boolean;
};

export default function TokenPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TokenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

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
        setResult(data as TokenResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToken() {
    if (!result) return;
    await navigator.clipboard.writeText(result.access_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const maskedToken = result
    ? revealed
      ? result.access_token
      : `${result.access_token.slice(0, 8)}${"•".repeat(24)}`
    : "";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">토큰 발급</h1>
      <p className="mt-1 text-sm text-slate-500">
        한국투자증권 Open API 접근토큰(access_token)을 발급받습니다. APP
        Key/Secret은 서버에서만 사용되며 브라우저로 전송되지 않습니다.
      </p>

      <button
        onClick={issueToken}
        disabled={loading}
        className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "발급 중..." : "토큰 발급받기"}
      </button>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Access Token {result.cached && "(캐시됨)"}
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => setRevealed((v) => !v)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                {revealed ? "숨기기" : "보기"}
              </button>
              <button
                onClick={copyToken}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          </div>
          <code className="block break-all rounded bg-slate-50 p-3 text-xs text-slate-700">
            {maskedToken}
          </code>
          <div className="flex justify-between text-xs text-slate-500">
            <span>token_type: {result.token_type}</span>
            <span>만료: {new Date(result.expires_at).toLocaleString("ko-KR")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
