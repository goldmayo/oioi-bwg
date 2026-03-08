import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * 글로벌 메타데이터 설정 (SEO 최적화)
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://oioibawige.com"),
  title: {
    template: "%s | 어이어이바위게",
    default: "어이어이바위게",
  },
  description: "바위게들을 위한 비공식 응원법, 어이어이바위게입니다. 바위게야 오늘은 응원을 하자!",
  keywords: [
    "QWER",
    "응원법",
    "어이어이바위게",
    "바위게",
    "CheerRockCrab",
    "OiOiBawige",
    "가사",
    "싱크",
  ],
  authors: [{ name: "CheerRockCrab Team" }],
  creator: "CheerRockCrab",
  publisher: "CheerRockCrab",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "어이어이바위게 | QWER 응원법",
    description: "바위게들을 위한 비공식 응원법 싱크 뷰어. 실시간 가사와 함께 응원법을 익혀보세요!",
    url: "https://oioibawige.com",
    siteName: "어이어이바위게",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/images/og_oioibawige.webp", // 기본 OG 이미지 (추후 전용 이미지로 교체 권장)
        width: 1200,
        height: 630,
        alt: "어이어이바위게 메인 이미지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "어이어이바위게 | QWER 응원법",
    description: "바위게들을 위한 비공식 응원법 싱크 뷰어.",
    images: ["/images/og_oioibawige.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

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
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
