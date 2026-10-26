import { drizzle } from "drizzle-orm/postgres-js";
import { inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";
import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";
const p = schema.servicePublication;
import { findPublicPublications } from "../../src/repositories/publication-repository";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Refusing non-isolated publication database");
const sql = postgres(url.toString(), { max: 2 });
const db = drizzle(sql, { schema });
const ids: string[] = [];
afterAll(async () => {
  if (ids.length) await db.delete(p).where(inArray(p.id, ids));
  await sql.end();
});
const fixture = {
  kind: "notice" as const,
  title: "공개 조회 검증",
  publishedOn: "2099-01-01",
  isPublished: true,
  category: "공지",
  releaseVersion: null,
  content: "본문",
};
test("기존 공개 게시물 세 건의 내용·날짜·UUID를 보존한다", async () => {
  const notices = await findPublicPublications(db, "notice");
  const updates = await findPublicPublications(db, "update");
  expect(notices).toHaveLength(1);
  expect(updates).toHaveLength(2);
  expect(notices[0]).toMatchObject({
    title: "리뉴얼 기념 서비스 점검 및 최적화 안내",
    publishedOn: "2026-04-06",
    category: "공지",
    content:
      "어이어이 바위게 리뉴얼 및 최적화 작업을 진행 중입니다. 더 빠르고 쾌적한 응원법 연습 환경을 위해 노력하겠습니다.",
  });
  expect(
    updates.map((row) => [row.title, row.publishedOn, row.releaseVersion, row.content]),
  ).toEqual([
    [
      "홈 모바일 뷰 리뉴얼",
      "2026-04-06",
      "v0.2.1",
      ["모바일 레이아웃 최적화", "탐색 뎁스 축소", "더보기 탭 추가"],
    ],
    ["서비스 런칭", "2026-03-09", "v0.1.0", ["서비스 오픈", "동영상기반 응원법 싱크 기능"]],
  ]);
  for (const row of [...notices, ...updates]) expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
});
test("종류·공개 여부를 필터링하고 표시 날짜·ID 내림차순을 적용한다", async () => {
  const created = await db
    .insert(p)
    .values([fixture, fixture, { ...fixture, isPublished: false }])
    .returning();
  ids.push(...created.map((row) => row.id));
  const items = await findPublicPublications(db, "notice");
  expect(items.slice(0, 2).map((row) => row.id)).toEqual(
    created
      .slice(0, 2)
      .map((row) => row.id)
      .sort()
      .reverse(),
  );
  expect(items.some((row) => row.id === created[2]!.id)).toBe(false);
  expect(items.some((row) => row.kind !== "notice")).toBe(false);
});
test("DB가 종류별 내용·항목 타입·개수·고유 버전명을 제한한다", async () => {
  for (const [kind, category, version, content] of [
    ["bad", "공지", null, "본문"],
    ["notice", "공지", null, []],
    ["notice", "공지", "v1", "본문"],
    ["update", null, "v2", []],
    ["update", null, "v3", [1]],
    ["update", null, "v4", [["nested"]]],
  ] as const) {
    await expect(
      sql`insert into service_publication (id,kind,title,published_on,category,release_version,content) values (${createEntityId()},${kind},'검증','2099-01-01',${category},${version},${JSON.stringify(content)}::jsonb)`,
    ).rejects.toMatchObject({ code: "23514" });
  }
  await expect(
    sql`insert into service_publication (id,kind,title,published_on,release_version,content) values (${createEntityId()},'update','검증','2099-01-01','v0.2.1','["중복"]'::jsonb)`,
  ).rejects.toMatchObject({
    code: "23505",
    constraint_name: "service_publication_release_version_key",
  });
});
