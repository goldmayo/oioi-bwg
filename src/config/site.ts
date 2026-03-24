import { Metadata } from "next";

export const SITE_CONFIG = {
  name: "어이어이바위게",
  shortName: "OIOIBWG",
  description: "QWER 비공식 응원법 가이드. 바위게야 오늘은 응원을 하자!",
  url: "https://oioibawige.com",
  ogImage: "/images/og_oioibawige.webp", // OG 이미지 경로
  author: "CheerRockCrab Team",
  links: {
    github: "https://github.com/oioibawige", // 예시
  },
  keywords: ["QWER", "응원법", "어이어이바위게", "바위게", "CheerRockCrab", "가사", "싱크"],
} as const;

export const DEFAULT_METADATA: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_ENV === "development" ? "http://localhost:3000" : SITE_CONFIG.url,
  ),
  title: {
    default: SITE_CONFIG.name,
    template: `%s | ${SITE_CONFIG.shortName}`,
  },
  description: SITE_CONFIG.description,
  keywords: [...SITE_CONFIG.keywords],
  authors: [{ name: SITE_CONFIG.author }],
  creator: SITE_CONFIG.author,
  /**
   * Next.js App Router는 src/app 폴더 내의 favicon.ico, apple-icon.png 등을
   * 자동으로 인식하므로 icons 속성을 명시적으로 설정하지 않는 것이 권장됩니다.
   */
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_CONFIG.url,
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: SITE_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: SITE_CONFIG.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};
