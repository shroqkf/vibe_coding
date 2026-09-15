import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">대시보드</h1>
      <p className="mt-1 text-sm text-slate-500">
        왼쪽 메뉴에서 기능을 선택하세요. 지금은 토큰 발급 기능이 준비되어 있습니다.
      </p>
      <Link
        href="/token"
        className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        토큰 발급하러 가기 →
      </Link>
    </div>
  );
}
