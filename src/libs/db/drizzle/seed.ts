import "dotenv/config";

import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

import { ALBUMS } from "@/types/album";
import { LyricLine } from "@/types/lyrics"; // 타입 추가
import { parseLrc } from "@/utils/lrc-parser";

import { getDb } from "./index";
import { song as songTable } from "./schema";

/**
 * 곡 제목을 URL용 고유 슬러그로 변환 (기존 로직 보존)
 */
function generateSlug(title: string): string {
  const map: Record<string, string> = {
    "별의 하모니": "harmony-of-stars",
    Discord: "discord",
    "수수께끼 다이어리": "secret-diary",
    고민중독: "t-b-h",
    SODA: "soda",
    자유선언: "free-dumb",
    지구정복: "g9jb",
    대관람차: "ferris-wheel",
    불꽃놀이: "make-our-highlight",
    마니또: "manito",
    가짜아이돌: "fake-idol",
    "내 이름 맑음": "my-name-is-malguem",
    사랑하자: "lets-love",
    달리기: "run-run-run",
    "안녕 나의 슬픔": "goodbye-my-sadness",
    메아리: "rebound",
    눈물참기: "dear",
    행복해져라: "be-happy",
    "검색어는 QWER": "qwer-hashtag",
    OVERDRIVE: "overdrive",
    "D-Day": "d-day",
    "Yours Sincerely": "yours-sincerely",
    청춘서약: "youth-promise",
    흰수염고래: "blue-whale",
  };

  return (
    map[title] ||
    title
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^a-z0-9-]/g, "")
  );
}

async function main() {
  const db = getDb();
  console.log("Drizzle 시딩 시작 (통합 ALBUMS 상수 기반)");

  for (const album of ALBUMS) {
    console.log(`📦 앨범 처리 중: ${album.name}`);
    for (let i = 0; i < album.songs.length; i++) {
      const songInfo = album.songs[i];
      const filePath = path.join(process.cwd(), "data/lyrics", songInfo.file);
      const slug = generateSlug(songInfo.title);

      let lyricsJson: LyricLine[] = []; // any 제거 및 명시적 타입 지정
      try {
        if (fs.existsSync(filePath)) {
          const lrcContent = fs.readFileSync(filePath, "utf-8");
          lyricsJson = parseLrc(lrcContent);
        }
      } catch (_err) {
        console.warn(`가사 파일 로드 실패: ${songInfo.file}`);
      }

      // 1. 기존 데이터 존재 여부 확인 (제목 또는 슬러그 기준)
      const existing = await db.query.song.findFirst({
        where: (s, { or, eq }) => or(eq(s.title, songInfo.title), eq(s.slug, slug)),
      });

      if (existing) {
        // 가사가 비어있을 때만 업데이트하는 로직 (unknown 타입 대응을 위해 Array.isArray 사용)
        const currentLyrics = existing.lyrics as LyricLine[];
        const shouldUpdateLyrics = !currentLyrics || currentLyrics.length === 0;

        await db
          .update(songTable)
          .set({
            slug,
            albumName: album.name,
            youtubeId: songInfo.youtubeId,
            hasOfficialCheer: songInfo.hasOfficial || false,
            order: i + 1,
            updatedAt: new Date().toISOString(),
            ...(shouldUpdateLyrics && { lyrics: lyricsJson }),
          })
          .where(eq(songTable.id, existing.id));

        console.log(`업데이트: ${songInfo.title} (${slug})`);
      } else {
        // 2. 신규 데이터 생성
        await db.insert(songTable).values({
          slug,
          title: songInfo.title,
          albumName: album.name,
          youtubeId: songInfo.youtubeId || "",
          lyrics: lyricsJson,
          hasOfficialCheer: songInfo.hasOfficial || false,
          order: i + 1,
          updatedAt: new Date().toISOString(),
        });

        console.log(`신규 추가: ${songInfo.title} (${slug})`);
      }
    }
  }

  console.log("Drizzle 시딩 완료");
}

main().catch((e) => {
  console.error("시딩 중 오류 발생:", e);
  process.exit(1);
});
