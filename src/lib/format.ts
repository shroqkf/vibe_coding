export function formatKrw(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toLocaleString("ko-KR")}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// 국내 증시 관례: 상승 = 빨강, 하락 = 파랑
export function changeColorClass(value: number): string {
  if (value > 0) return "text-toss-red";
  if (value < 0) return "text-toss-blue";
  return "text-toss-gray-500";
}
