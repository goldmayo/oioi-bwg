import { Metadata } from "next";

import { SITE_CONFIG } from "@/config/site";

interface ConstructMetadataProps {
  title?: string;
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
  description = SITE_CONFIG.description,
  image = SITE_CONFIG.ogImage,
  noIndex = false,
}: ConstructMetadataProps = {}): Metadata {
  const fullTitle = title ? `${title} | ${SITE_CONFIG.shortName}` : SITE_CONFIG.name;

  return {
    title: fullTitle,
    description,
    openGraph: {
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
      creator: "@CheerRockCrab", // 예시
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
