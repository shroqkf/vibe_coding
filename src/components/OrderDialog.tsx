"use client";

import { useState } from "react";
import { formatKrw } from "@/lib/format";

type Props = {
  code: string;
  name: string;
  currentPrice: number;
  initialSide?: "buy" | "sell";
  onClose: () => void;
  onOrdered: () => void;
};

type Side = "buy" | "sell";
type PriceType = "market" | "limit";

export default function OrderDialog({
  code,
  name,
  currentPrice,
  initialSide = "buy",
  onClose,
  onOrdered,
}: Props) {
  const [side, setSide] = useState<Side>(initialSide);
  const [priceType, setPriceType] = useState<PriceType>("market");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(currentPrice);
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedAmount = quantity * (priceType === "market" ? currentPrice : price);

  async function submitOrder() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/kis/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          side,
          priceType,
          quantity,
          price: priceType === "limit" ? price : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "주문에 실패했습니다.");
        setStep("input");
        return;
      }
      onOrdered();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
      setStep("input");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-toss-lg sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-toss-gray-900">
            {name} <span className="text-toss-gray-400">({code})</span>
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-toss-gray-400 hover:bg-toss-gray-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {step === "input" && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide("buy")}
                className={`rounded-xl py-2.5 text-sm font-bold transition ${
                  side === "buy"
                    ? "bg-toss-red text-white"
                    : "bg-toss-gray-100 text-toss-gray-500"
                }`}
              >
                매수
              </button>
              <button
                onClick={() => setSide("sell")}
                className={`rounded-xl py-2.5 text-sm font-bold transition ${
                  side === "sell"
                    ? "bg-toss-blue text-white"
                    : "bg-toss-gray-100 text-toss-gray-500"
                }`}
              >
                매도
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPriceType("market")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  priceType === "market"
                    ? "bg-toss-gray-900 text-white"
                    : "bg-toss-gray-100 text-toss-gray-500"
                }`}
              >
                시장가
              </button>
              <button
                onClick={() => setPriceType("limit")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  priceType === "limit"
                    ? "bg-toss-gray-900 text-white"
                    : "bg-toss-gray-100 text-toss-gray-500"
                }`}
              >
                지정가
              </button>
            </div>

            <label className="mt-5 block text-xs font-semibold text-toss-gray-500">
              수량
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full rounded-xl border border-toss-gray-200 px-4 py-3 text-sm font-semibold text-toss-gray-900 outline-none focus:border-toss-blue"
            />

            {priceType === "limit" && (
              <>
                <label className="mt-4 block text-xs font-semibold text-toss-gray-500">
                  가격
                </label>
                <input
                  type="number"
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full rounded-xl border border-toss-gray-200 px-4 py-3 text-sm font-semibold text-toss-gray-900 outline-none focus:border-toss-blue"
                />
              </>
            )}

            <div className="mt-5 rounded-xl bg-toss-gray-50 px-4 py-3 text-sm">
              <div className="flex justify-between text-toss-gray-500">
                <span>예상 주문금액</span>
                <span className="font-bold text-toss-gray-900">
                  {formatKrw(expectedAmount)}
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-medium text-toss-red">
                {error}
              </div>
            )}

            <button
              onClick={() => setStep("confirm")}
              className={`mt-5 w-full rounded-2xl py-4 text-[15px] font-bold text-white transition ${
                side === "buy" ? "bg-toss-red hover:opacity-90" : "bg-toss-blue hover:bg-toss-blue-dark"
              }`}
            >
              {side === "buy" ? "매수" : "매도"} 주문하기
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="mt-5 space-y-3 rounded-2xl bg-toss-gray-50 p-5">
              <p className="text-sm text-toss-gray-500">아래 내용으로 주문할까요?</p>
              <div className="flex justify-between text-sm">
                <span className="text-toss-gray-500">구분</span>
                <span className="font-bold text-toss-gray-900">
                  {side === "buy" ? "매수" : "매도"} · {priceType === "market" ? "시장가" : "지정가"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-toss-gray-500">수량</span>
                <span className="font-bold text-toss-gray-900">{quantity}주</span>
              </div>
              {priceType === "limit" && (
                <div className="flex justify-between text-sm">
                  <span className="text-toss-gray-500">가격</span>
                  <span className="font-bold text-toss-gray-900">{formatKrw(price)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-toss-gray-200 pt-3 text-sm">
                <span className="text-toss-gray-500">예상 주문금액</span>
                <span className="font-bold text-toss-gray-900">
                  {formatKrw(expectedAmount)}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setStep("input")}
                disabled={submitting}
                className="rounded-2xl bg-toss-gray-100 py-4 text-[15px] font-bold text-toss-gray-700 transition hover:bg-toss-gray-200 disabled:opacity-50"
              >
                다시 확인
              </button>
              <button
                onClick={submitOrder}
                disabled={submitting}
                className={`rounded-2xl py-4 text-[15px] font-bold text-white transition disabled:opacity-50 ${
                  side === "buy" ? "bg-toss-red hover:opacity-90" : "bg-toss-blue hover:bg-toss-blue-dark"
                }`}
              >
                {submitting ? "주문 중..." : "확인, 주문 제출"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
