import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

import { Prisma, PrismaClient } from "../src/app/generated/prisma/client";
import { Album } from "../src/types/album";
import { parseLrc } from "../src/utils/lrc-parser";

/**
 * Supabase 비밀번호의 특수문자 문제를 해결하기 위해
 * 연결 문자열을 안전하게 재구성합니다.
 */
function getSafeConnectionString(): string {
  const rawUrl = process.env.DIRECT_URL || "";
  if (!rawUrl) throw new Error("DIRECT_URL이 정의되어 있지 않습니다.");

  try {
    const url = new URL(rawUrl);
    // 비밀번호 부분만 인코딩하여 다시 조립
    const password = url.password;
    url.password = encodeURIComponent(password);
    return url.toString();
  } catch (_e) {
    // URL 형식이 아닐 경우 원본 반환
    return rawUrl;
  }
}

const connectionString = getSafeConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ALBUMS: Album[] = [
  {
    name: "1st Single Album: Harmony from Discord",
    songs: [
      { title: "별의 하모니", file: "QWER - Harmony of Stars.lrc", youtubeId: "1BTTbopyDWw" },
      { title: "Discord", file: "QWER - Discord.lrc", youtubeId: "-kcZNuFYnns" },
      { title: "수수께끼 다이어리", file: "QWER - Secret Diary.lrc", youtubeId: "H6alWf2odU8" },
    ],
  },
  {
    name: "1st Mini Album: MANITO",
    songs: [
      { title: "고민중독", file: "QWER - T.B.H.lrc", youtubeId: "pbELDkeLdho" },
      { title: "SODA", file: "QWER - SODA.lrc", youtubeId: "SKztjYndS_s" },
      { title: "자유선언", file: "QWER - Free-Dumb.lrc", youtubeId: "Tor2ElSVEAk" },
      { title: "지구정복", file: "QWER - G9JB.lrc", youtubeId: "a0OkChjJWl8" },
      { title: "대관람차", file: "QWER - Ferris Wheel.lrc", youtubeId: "cmnJZFlKXUU" },
      { title: "불꽃놀이", file: "QWER - Make Our Highlight.lrc", youtubeId: "HBsU1GpsGKw" },
      { title: "마니또", file: "QWER - Manito.lrc", youtubeId: "bjq3GHO_Cc0" },
    ],
  },
  {
    name: "2nd Mini Album: Algorithm's Blossom",
    songs: [
      { title: "가짜아이돌", file: "QWER - FAKE IDOL.lrc", youtubeId: "derG9wlkd40" },
      {
        title: "내 이름 맑음",
        file: "QWER - My Name is Malguem.lrc",
        hasOfficial: true,
        youtubeId: "9yfrVqCcrS0",
      },
      { title: "사랑하자", file: "QWER - Let’s Love.lrc", youtubeId: "91Mn22CFvCE" },
      { title: "달리기", file: "QWER - run! run! run!.lrc", youtubeId: "txAakIbx4lA" },
      { title: "안녕 나의 슬픔", file: "QWER - Goodbye My Sadness.lrc", youtubeId: "8ShYRkhBD2s" },
      { title: "메아리", file: "QWER - REBOUND.lrc", youtubeId: "5kf41s91RE8" },
    ],
  },
  {
    name: "3rd Mini Album: In a million noises, I'll be your harmony",
    songs: [
      { title: "눈물참기", file: "QWER - Dear.lrc", hasOfficial: true, youtubeId: "SUx0-btw2nQ" },
      {
        title: "행복해져라",
        file: "QWER - Be Happy.lrc",
        hasOfficial: true,
        youtubeId: "PRH8JkIe0Ho",
      },
      { title: "검색어는 QWER", file: "QWER - #QWER.lrc", youtubeId: "8-XjAXrS0bs" },
      { title: "OVERDRIVE", file: "QWER - Overdrive.lrc", youtubeId: "kdPfMUAzmSo" },
      { title: "D-Day", file: "QWER - D-DAY.lrc", youtubeId: "YCaTtV9zu6A" },
      { title: "Yours Sincerely", file: "QWER - Yours Sincerely.lrc", youtubeId: "-Fz2vfp4BdY" },
    ],
  },
  {
    name: "Digital Single: Youth Promise",
    songs: [{ title: "청춘서약", file: "QWER - Youth Promise.lrc", youtubeId: "CGvqj7bzCVY" }],
  },
  {
    name: "Singles",
    songs: [{ title: "흰수염고래", file: "QWER - Blue Whale.lrc", youtubeId: "h_S_Un3YoFo" }],
  },
];

async function main() {
  console.log("시딩 시작 (Upsert 모드)");

  for (const album of ALBUMS) {
    console.log(`앨범 처리 중: ${album.name}`);
    for (let i = 0; i < album.songs.length; i++) {
      const songInfo = album.songs[i];
      const filePath = path.join(process.cwd(), "prisma/lyrics", songInfo.file);

      let lyricsJson: Prisma.InputJsonValue = [];
      try {
        const lrcContent = fs.readFileSync(filePath, "utf-8");
        lyricsJson = parseLrc(lrcContent) as unknown as Prisma.InputJsonValue;
      } catch (_err) {
        console.warn(`파일을 찾을 수 없음: ${songInfo.file}`);
      }

      // 제목을 고유 식별자로 사용하여 upsert
      const existingSong = await prisma.song.findFirst({
        where: { title: songInfo.title },
      });

      if (existingSong) {
        // 이미 곡이 존재하면, youtubeId, albumName, order 등 메타데이터만 업데이트하고
        // lyrics는 기존 DB 값을 보존합니다 (수동으로 수정한 싱크가 날아가지 않도록).
        const shouldUpdateLyrics =
          !existingSong.lyrics ||
          (Array.isArray(existingSong.lyrics) && existingSong.lyrics.length === 0);

        await prisma.song.update({
          where: { id: existingSong.id },
          data: {
            albumName: album.name,
            youtubeId: songInfo.youtubeId,
            hasOfficialCheer: songInfo.hasOfficial || false,
            order: i + 1,
            ...(shouldUpdateLyrics && { lyrics: lyricsJson }),
          },
        });
        console.log(`  - 업데이트 됨: ${songInfo.title}`);
      } else {
        // 새로운 곡인 경우 생성
        await prisma.song.create({
          data: {
            title: songInfo.title,
            albumName: album.name,
            youtubeId: songInfo.youtubeId || "",
            lyrics: lyricsJson,
            hasOfficialCheer: songInfo.hasOfficial || false,
            order: i + 1,
          },
        });
        console.log(`  - 새로 추가됨: ${songInfo.title}`);
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
