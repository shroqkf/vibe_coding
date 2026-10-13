"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  {
    href: "/",
    label: "홈",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M4 11.5 12 4l8 7.5"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 10v8a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-8"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/quote",
    label: "종목 조회",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
        <path
          d="M20 20 15 15"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.8}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "계좌",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect
          x="3.5"
          y="6"
          width="17"
          height="13"
          rx="2"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.8}
        />
        <path
          d="M3.5 10h17"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.8}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-toss-gray-200 bg-white sm:flex sm:flex-col">
      <div className="flex items-center gap-2 px-6 py-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-toss-blue text-sm font-bold text-white">
          K
        </span>
        <span className="text-lg font-bold tracking-tight text-toss-gray-900">
          KIS 모의투자
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-4">
        {nav.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-colors ${
                active
                  ? "bg-toss-blue-light text-toss-blue"
                  : "text-toss-gray-500 hover:bg-toss-gray-50 hover:text-toss-gray-800"
              }`}
            >
              {item.icon(active)}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 pb-6 text-xs text-toss-gray-400">
        © {new Date().getFullYear()} KIS 모의투자
      </div>
    </aside>
  );
}
