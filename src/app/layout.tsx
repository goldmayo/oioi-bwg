import { GoogleTagManager } from "@next/third-parties/google";
import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/app/providers";

import { DEFAULT_METADATA } from "@/shared/config/site";
import { Toaster } from "@/shared/ui/sonner";

import { InAppBrowserGuard } from "./_ui/in-app-browser-guard";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 설정 파일의 기본 메타데이터 적용
export const metadata = DEFAULT_METADATA;

/**
 * 뷰포트 설정
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* 인앱 브라우저 탈출을 위한 투명 가드 */}
        <InAppBrowserGuard />
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          expand
          visibleToasts={3}
          duration={4000}
          toastOptions={{
            className: "text-base font-bold tracking-tight px-6 py-3.5 justify-center",
          }}
        />
      </body>
    </html>
  );
}
