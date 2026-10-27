import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

export const fixtureSlug = "lyrics-regression";
const segment = (text, flags = {}) => ({ text, isCheer: false, isEcho: false, ...flags });
export const fixtureLyrics = [
  { startTime: 1, segments: [segment("일반 가사")], isExtra: false },
  { startTime: 3, segments: [segment("함께 부르는 응원", { isCheer: true })], isExtra: false },
  { startTime: 5, segments: [segment("isEcho 검증 문구", { isEcho: true })], isExtra: false },
  {
    startTime: 7,
    segments: [segment("네임콜 하나"), segment("네임콜 둘", { startTimeOffset: 1 })],
    isExtra: true,
  },
  ...Array.from({ length: 8 }, (_, index) => ({
    startTime: 11 + index * 2,
    segments: [segment(`이어지는 가사 ${index + 1}`)],
    isExtra: false,
  })),
];

// CI의 빈 smoke DB 또는 명시적으로 생성한 격리 DB에서만 실행한다.
export async function prepareLyricsFixture(value) {
  const url = new URL(value);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.equal(url.search + url.hash, "");
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.ok(
    ["/image_smoke", "/promotion_smoke"].includes(url.pathname) ||
      /^\/oioi_m7_test_lyrics_[a-z0-9_]+$/.test(url.pathname),
  );
  const sql = postgres(url.href, { max: 1 });
  const id = (n) => `019a0170-0000-7000-8000-${String(n).padStart(12, "0")}`;
  try {
    await sql.begin(async (tx) => {
      const [row] = await tx`select count(*)::int as count from album`;
      assert.equal(row.count, 0, "Lyrics fixture requires an empty isolated database");
      await tx`insert into account (id,role,status) values (${id(1)},'ADMIN','ACTIVE')`;
      await tx`insert into album (id,name,slug,image_url,color) values (${id(2)},'회귀 검증',${fixtureSlug},'/favicon.ico','#000000')`;
      await tx`insert into song (id,album_id,title,slug,youtube_id,lyrics,created_at,updated_at) values (${id(3)},${id(2)},'응원법 회귀 검증',${fixtureSlug},'fixture-video',${tx.json(fixtureLyrics)},now(),now())`;
      for (const [index, mode] of ["CONCERT", "FESTIVAL"].entries()) {
        const guide = id(10 + index * 3),
          snapshot = id(11 + index * 3),
          publication = id(12 + index * 3);
        await tx`insert into cheer_guide (id,song_id,mode) values (${guide},${id(3)},${mode})`;
        await tx`insert into cheer_guide_snapshot (id,cheer_guide_id,version_no,lyrics,reference_youtube_id,source_type,change_summary) values (${snapshot},${guide},1,${tx.json(fixtureLyrics)},'fixture-video','FANDOM','격리 브라우저 검증')`;
        await tx`insert into cheer_guide_publication (id,cheer_guide_id,publication_no,action,snapshot_id,actor_account_id,reason) values (${publication},${guide},1,'PUBLISH',${snapshot},${id(1)},'격리 브라우저 검증')`;
        await tx`update cheer_guide set current_publication_id=${publication} where id=${guide}`;
      }
    });
  } finally {
    await sql.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepareLyricsFixture(process.env.LYRICS_SMOKE_DATABASE_URL);
  console.log("Isolated lyrics fixture prepared");
}
