"use client";

import { useEffect, useState } from "react";
import { changeColorClass, formatKrw, formatPercent, formatSigned } from "@/lib/format";
import type { AccountSummary } from "@/lib/kis/account";
import type { OrderRecord } from "@/lib/kis/order";

const STATUS_LABEL: Record<OrderRecord["status"], string> = {
  filled: "체결완료",
  partial: "부분체결",
  open: "미체결",
};

export default function AccountPage() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelingOrderNo, setCancelingOrderNo] = useState<string | null>(null);
  const [modifyingOrder, setModifyingOrder] = useState<OrderRecord | null>(null);
  const [modifyPrice, setModifyPrice] = useState(0);
  const [submittingModify, setSubmittingModify] = useState(false);

  async function load() {
    setLoading(true);
    const [accountRes, ordersRes] = await Promise.all([
      fetch("/api/kis/account"),
      fetch("/api/kis/orders"),
    ]);
    const accountData = await accountRes.json();
    if (accountRes.ok) {
      setAccount(accountData);
      setAccountError(null);
    } else {
      setAccountError(accountData.error ?? "계좌 정보를 불러오지 못했습니다.");
    }

    const ordersData = await ordersRes.json();
    if (ordersRes.ok) {
      setOrders(ordersData.orders ?? []);
      setOrdersError(null);
    } else {
      setOrdersError(ordersData.error ?? "주문내역을 불러오지 못했습니다.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function cancelOrder(order: OrderRecord) {
    if (!confirm(`${order.name} 주문(${order.quantity - order.filledQuantity}주 미체결)을 취소할까요?`)) {
      return;
    }
    setCancelingOrderNo(order.orderNo);
    try {
      const res = await fetch(`/api/kis/orders/${order.orderNo}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderBranchNo: order.orderBranchNo,
          quantity: order.quantity - order.filledQuantity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "취소에 실패했습니다.");
        return;
      }
      await load();
    } finally {
      setCancelingOrderNo(null);
    }
  }

  function openModify(order: OrderRecord) {
    setModifyingOrder(order);
    setModifyPrice(order.price);
  }

  async function submitModify() {
    if (!modifyingOrder) return;
    setSubmittingModify(true);
    try {
      const res = await fetch(`/api/kis/orders/${modifyingOrder.orderNo}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderBranchNo: modifyingOrder.orderBranchNo,
          quantity: modifyingOrder.quantity - modifyingOrder.filledQuantity,
          price: modifyPrice,
          priceType: "limit",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "정정에 실패했습니다.");
        return;
      }
      setModifyingOrder(null);
      await load();
    } finally {
      setSubmittingModify(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-toss-gray-900">계좌</h1>

      {accountError && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-toss-red">
          {accountError}
        </div>
      )}

      {account && (
        <section className="mt-4 rounded-3xl bg-gradient-to-br from-toss-blue to-toss-blue-dark p-6 text-white shadow-toss-lg sm:p-8">
          <p className="text-sm font-semibold text-blue-100">모의투자 계좌 요약</p>
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
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-toss-gray-900">보유 종목</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-toss-gray-200 bg-white shadow-toss">
          {loading && <p className="p-6 text-center text-sm text-toss-gray-400">불러오는 중...</p>}
          {!loading && (account?.holdings.length ?? 0) === 0 && !accountError && (
            <p className="p-6 text-center text-sm text-toss-gray-400">보유 중인 종목이 없어요.</p>
          )}
          {!loading && account && account.holdings.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-toss-gray-100 text-left text-xs text-toss-gray-400">
                  <th className="px-5 py-3 font-medium">종목</th>
                  <th className="px-5 py-3 font-medium">수량</th>
                  <th className="px-5 py-3 font-medium">평단가</th>
                  <th className="px-5 py-3 font-medium">현재가</th>
                  <th className="px-5 py-3 text-right font-medium">평가손익</th>
                </tr>
              </thead>
              <tbody>
                {account.holdings.map((h) => (
                  <tr key={h.code} className="border-b border-toss-gray-50 last:border-0">
                    <td className="px-5 py-3 font-semibold text-toss-gray-900">{h.name}</td>
                    <td className="px-5 py-3 text-toss-gray-700">{h.quantity}주</td>
                    <td className="px-5 py-3 text-toss-gray-700">
                      {h.avgPrice.toLocaleString("ko-KR")}
                    </td>
                    <td className="px-5 py-3 text-toss-gray-700">
                      {h.currentPrice.toLocaleString("ko-KR")}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${changeColorClass(h.profitLoss)}`}>
                      {formatSigned(h.profitLoss)}원 ({formatPercent(h.profitLossRate)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-toss-gray-900">당일 주문내역</h2>
        {ordersError && (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-toss-red">
            {ordersError}
          </div>
        )}
        <div className="mt-4 overflow-hidden rounded-2xl border border-toss-gray-200 bg-white shadow-toss">
          {loading && <p className="p-6 text-center text-sm text-toss-gray-400">불러오는 중...</p>}
          {!loading && orders.length === 0 && !ordersError && (
            <p className="p-6 text-center text-sm text-toss-gray-400">오늘 주문 내역이 없어요.</p>
          )}
          {!loading && orders.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-toss-gray-100 text-left text-xs text-toss-gray-400">
                  <th className="px-5 py-3 font-medium">종목</th>
                  <th className="px-5 py-3 font-medium">구분</th>
                  <th className="px-5 py-3 font-medium">수량(체결)</th>
                  <th className="px-5 py-3 font-medium">가격</th>
                  <th className="px-5 py-3 font-medium">상태</th>
                  <th className="px-5 py-3 text-right font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.orderNo} className="border-b border-toss-gray-50 last:border-0">
                    <td className="px-5 py-3 font-semibold text-toss-gray-900">{o.name}</td>
                    <td className={`px-5 py-3 font-semibold ${o.side === "buy" ? "text-toss-red" : "text-toss-blue"}`}>
                      {o.side === "buy" ? "매수" : "매도"}
                    </td>
                    <td className="px-5 py-3 text-toss-gray-700">
                      {o.quantity}주 ({o.filledQuantity}주)
                    </td>
                    <td className="px-5 py-3 text-toss-gray-700">
                      {o.price > 0 ? o.price.toLocaleString("ko-KR") : "시장가"}
                    </td>
                    <td className="px-5 py-3 text-toss-gray-500">{STATUS_LABEL[o.status]}</td>
                    <td className="px-5 py-3 text-right">
                      {o.status !== "filled" && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openModify(o)}
                            className="rounded-full bg-toss-gray-100 px-3 py-1.5 text-xs font-semibold text-toss-gray-700 transition hover:bg-toss-gray-200"
                          >
                            정정
                          </button>
                          <button
                            onClick={() => cancelOrder(o)}
                            disabled={cancelingOrderNo === o.orderNo}
                            className="rounded-full bg-toss-gray-100 px-3 py-1.5 text-xs font-semibold text-toss-gray-700 transition hover:bg-toss-gray-200 disabled:opacity-50"
                          >
                            {cancelingOrderNo === o.orderNo ? "취소 중..." : "취소"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {modifyingOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-toss-lg sm:rounded-3xl">
            <h2 className="text-lg font-bold text-toss-gray-900">
              {modifyingOrder.name} 주문 정정
            </h2>
            <p className="mt-1 text-sm text-toss-gray-500">
              미체결 {modifyingOrder.quantity - modifyingOrder.filledQuantity}주를 지정가로
              정정해요.
            </p>
            <label className="mt-5 block text-xs font-semibold text-toss-gray-500">
              새 가격
            </label>
            <input
              type="number"
              min={1}
              value={modifyPrice}
              onChange={(e) => setModifyPrice(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full rounded-xl border border-toss-gray-200 px-4 py-3 text-sm font-semibold text-toss-gray-900 outline-none focus:border-toss-blue"
            />
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setModifyingOrder(null)}
                disabled={submittingModify}
                className="rounded-2xl bg-toss-gray-100 py-4 text-[15px] font-bold text-toss-gray-700 transition hover:bg-toss-gray-200 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={submitModify}
                disabled={submittingModify}
                className="rounded-2xl bg-toss-blue py-4 text-[15px] font-bold text-white transition hover:bg-toss-blue-dark disabled:opacity-50"
              >
                {submittingModify ? "정정 중..." : "정정 제출"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
