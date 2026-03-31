"use cache";

import { MetadataRoute } from "next";

import { getAllSongs } from "@/shared/api/db/drizzle/queries";

/**
 * 동적 사이트맵 생성
 * 모든 곡 상세 페이지를 검색 엔진에 노출시킵니다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://oioibawige.com";

  // 1. 모든 곡 데이터 가져오기
  const songs = await getAllSongs();

  // 2. 곡 상세 페이지 URL 목록 생성
  const songUrls = songs.map((song) => ({
    url: `${baseUrl}/songs/${song.slug}`,
    lastModified: new Date(song.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // 3. 기본 페이지 URL 목록
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...songUrls,
  ];
}
