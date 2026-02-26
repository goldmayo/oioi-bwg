import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

import { Prisma, PrismaClient } from "../app/generated/prisma/client";
import { Album } from "../types/album";
import { parseLRC } from "../utils/lrc-parser";

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
  } catch (e) {
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
      { title: "별의 하모니", file: "QWER - Harmony of Stars.lrc" },
      { title: "Discord", file: "QWER - Discord.lrc" },
      { title: "수수께끼 다이어리(Secret Diary)", file: "QWER - Secret Diary.lrc" },
    ],
  },
  {
    name: "1st Mini Album: MANITO",
    songs: [
      { title: "고민중독(T.B.H)", file: "QWER - T.B.H.lrc" },
      { title: "SODA", file: "QWER - SODA.lrc" },
      { title: "마니또(Manito)", file: "QWER - Manito.lrc" },
      { title: "자유선언", file: "QWER - Free-Dumb.lrc" },
      { title: "지구정복", file: "QWER - G9JB.lrc" },
      { title: "대관람차", file: "QWER - Ferris Wheel.lrc" },
      { title: "불꽃놀이", file: "QWER - Make Our Highlight.lrc" },
    ],
  },
  {
    name: "2nd Mini Album: Algorithm's Blossom",
    songs: [
      { title: "내 이름 맑음", file: "QWER - My Name is Malguem.lrc", hasOfficial: true },
      { title: "가짜아이돌", file: "QWER - FAKE IDOL.lrc" },
      { title: "사랑하자", file: "QWER - Let’s Love.lrc" },
      { title: "달리기", file: "QWER - run! run! run!.lrc" },
      { title: "안녕 나의 슬픔", file: "QWER - Goodbye My Sadness.lrc" },
      { title: "메아리", file: "QWER - REBOUND.lrc" },
      { title: "REBOUND", file: "QWER - REBOUND.lrc" },
      { title: "run! run! run!", file: "QWER - run! run! run!.lrc" },
    ],
  },
  {
    name: "3rd Mini Album: In a million noises, I'll be your harmony",
    songs: [
      { title: "가보자(OVERDRIVE)", file: "QWER - Overdrive.lrc" },
      { title: "Yours Sincerely", file: "QWER - Yours Sincerely.lrc" },
      { title: "#QWER", file: "QWER - #QWER.lrc" },
      { title: "눈물참기", file: "QWER - Dear.lrc", hasOfficial: true },
      { title: "행복해져라", file: "QWER - Be Happy.lrc", hasOfficial: true },
      { title: "검색어는 QWER", file: "QWER - #QWER.lrc" },
      { title: "D-Day", file: "QWER - D-DAY.lrc" },
    ],
  },
  {
    name: "Digital Single: Youth Promise",
    songs: [{ title: "청춘서약", file: "QWER - Youth Promise.lrc" }],
  },
  {
    name: "Singles",
    songs: [{ title: "흰수염고래", file: "QWER - Blue Whale.lrc" }],
  },
];

async function main() {
  console.log("시딩 시작");

  await prisma.song.deleteMany({});

  for (const album of ALBUMS) {
    console.log(`앨범 처리 중: ${album.name}`);
    for (let i = 0; i < album.songs.length; i++) {
      const songInfo = album.songs[i];
      const filePath = path.join(process.cwd(), "docs/projects/lyrics", songInfo.file);

      let lyricsJson: Prisma.InputJsonValue = [];
      try {
        const lrcContent = fs.readFileSync(filePath, "utf-8");
        lyricsJson = parseLRC(lrcContent) as unknown as Prisma.InputJsonValue;
      } catch (err) {
        console.warn(`파일을 찾을 수 없음: ${songInfo.file}`);
      }

      await prisma.song.create({
        data: {
          title: songInfo.title,
          albumName: album.name,
          youtubeId: "",
          lyrics: lyricsJson,
          hasOfficialCheer: songInfo.hasOfficial || false,
          order: i + 1,
        },
      });
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
