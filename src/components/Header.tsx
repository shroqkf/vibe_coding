export default function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-toss-gray-200 bg-white px-6 sm:px-10">
      <span className="text-sm font-medium text-toss-gray-500">
        한국투자증권 Open API
      </span>
      <span className="flex items-center gap-1.5 rounded-full bg-toss-blue-light px-3 py-1.5 text-xs font-semibold text-toss-blue">
        <span className="h-1.5 w-1.5 rounded-full bg-toss-blue" />
        모의투자 연동
      </span>
    </header>
  );
}
