import { Metadata } from "next";

import { SITE_CONFIG } from "@/shared/config/site";

interface ConstructMetadataProps {
  title?: string;
  path?: string;
  description?: string;
  image?: string;
  noIndex?: boolean;
}

/**
 * 페이지별 메타데이터를 편리하게 생성해주는 헬퍼 함수
 * 기본값과 전달받은 값을 병합하여 완성된 Metadata 객체를 반환합니다.
 */
export function constructMetadata({
  title,
  path = "/",
  description = SITE_CONFIG.description,
  image = SITE_CONFIG.ogImage,
  noIndex = false,
}: ConstructMetadataProps = {}): Metadata {
  const pageTitle = title ?? SITE_CONFIG.name;
  const fullTitle = title ? `${title} | ${SITE_CONFIG.name}` : SITE_CONFIG.name;
  const url = new URL(path, SITE_CONFIG.url).toString();

  return {
    title: pageTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: SITE_CONFIG.name,
      url,
      title: fullTitle,
      description,
      images: [
        {
          url: image,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
    icons: "/favicon.ico",
    metadataBase: new URL(SITE_CONFIG.url),
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
