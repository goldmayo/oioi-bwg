import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

import { Prisma, PrismaClient } from "../src/app/generated/prisma/client";
import { ALBUMS } from "../src/types/album"; // 통합 상수 사용
import { parseLrc } from "../src/utils/lrc-parser";

/**
 * 곡 제목을 URL용 고유 슬러그로 변환합니다.
 * (중복 방지를 위해 곡별로 수동 지정하거나, 제목 기반 변환 로직 적용)
 */
function generateSlug(title: string): string {
  const map: Record<string, string> = {
    "별의 하모니": "harmony-of-stars",
    "Discord": "discord",
    "수수께끼 다이어리": "secret-diary",
    "고민중독": "t-b-h",
    "SODA": "soda",
    "자유선언": "free-dumb",
    "지구정복": "g9jb",
    "대관람차": "ferris-wheel",
    "불꽃놀이": "make-our-highlight",
    "마니또": "manito",
    "가짜아이돌": "fake-idol",
    "내 이름 맑음": "my-name-is-malguem",
    "사랑하자": "lets-love",
    "달리기": "run-run-run",
    "안녕 나의 슬픔": "goodbye-my-sadness",
    "메아리": "rebound",
    "눈물참기": "dear",
    "행복해져라": "be-happy",
    "검색어는 QWER": "qwer-hashtag",
    "OVERDRIVE": "overdrive",
    "D-Day": "d-day",
    "Yours Sincerely": "yours-sincerely",
    "청춘서약": "youth-promise",
    "흰수염고래": "blue-whale",
  };
  
  return map[title] || title.toLowerCase().replace(/ /g, "-").replace(/[^a-z0-9-]/g, "");
}

function getSafeConnectionString(): string {
  const rawUrl = process.env.DIRECT_URL || "";
  if (!rawUrl) throw new Error("DIRECT_URL이 정의되어 있지 않습니다.");

  try {
    const url = new URL(rawUrl);
    const password = url.password;
    url.password = encodeURIComponent(password);
    return url.toString();
  } catch (_e) {
    return rawUrl;
  }
}

const connectionString = getSafeConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("시딩 시작 (통합 ALBUMS 상수 기반)");

  for (const album of ALBUMS) {
    console.log(`앨범 처리 중: ${album.name}`);
    for (let i = 0; i < album.songs.length; i++) {
      const songInfo = album.songs[i];
      const filePath = path.join(process.cwd(), "prisma/lyrics", songInfo.file);
      const slug = generateSlug(songInfo.title);

      let lyricsJson: Prisma.InputJsonValue = [];
      try {
        const lrcContent = fs.readFileSync(filePath, "utf-8");
        lyricsJson = parseLrc(lrcContent) as unknown as Prisma.InputJsonValue;
      } catch (_err) {
        console.warn(`파일을 찾을 수 없음: ${songInfo.file}`);
      }

      // 제목 또는 슬러그를 고유 식별자로 사용하여 upsert
      const existingSong = await prisma.song.findFirst({
        where: { OR: [{ title: songInfo.title }, { slug }] },
      });

      if (existingSong) {
        const shouldUpdateLyrics =
          !existingSong.lyrics ||
          (Array.isArray(existingSong.lyrics) && existingSong.lyrics.length === 0);

        await prisma.song.update({
          where: { id: existingSong.id },
          data: {
            slug,
            albumName: album.name,
            youtubeId: songInfo.youtubeId,
            hasOfficialCheer: songInfo.hasOfficial || false,
            order: i + 1,
            ...(shouldUpdateLyrics && { lyrics: lyricsJson }),
          },
        });
        console.log(`  - 업데이트 됨: ${songInfo.title} (${slug})`);
      } else {
        await prisma.song.create({
          data: {
            slug,
            title: songInfo.title,
            albumName: album.name,
            youtubeId: songInfo.youtubeId || "",
            lyrics: lyricsJson,
            hasOfficialCheer: songInfo.hasOfficial || false,
            order: i + 1,
          },
        });
        console.log(`  - 새로 추가됨: ${songInfo.title} (${slug})`);
      }
    }
  }

  console.log("시딩 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
