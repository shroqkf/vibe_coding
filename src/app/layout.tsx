import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "KIS 대시보드",
  description: "한국투자증권 Open API 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-toss-gray-100 font-sans text-toss-gray-900 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <Header />
            <main className="flex-1 px-6 py-8 sm:px-10">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
