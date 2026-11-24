import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, expect, test } from "vitest";

import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Refusing non-isolated home carousel database");
const sql = postgres(url.toString(), { max: 2 });
const db = drizzle(sql, { schema });
const carousel = schema.homeCarousel;
afterEach(async () => {
  await db.delete(carousel);
});
afterAll(async () => {
  await sql.end();
});

test("CAROUSEL-002 migration은 운영 콘텐츠를 주입하지 않고 최초 구성의 기본값을 보존한다", async () => {
  expect(await db.select().from(carousel)).toEqual([]);
  const [row] = await db.insert(carousel).values({ placement: "home" }).returning();
  expect(row).toMatchObject({
    placement: "home",
    draftSlides: [],
    publishedSlides: [],
    lockVersion: 1,
    publishedAt: null,
  });
  expect(row!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
});

test("CAROUSEL-002 동시 최초 구성은 placement 고유 제약으로 하나만 생성된다", async () => {
  const results = await Promise.all(
    [0, 1].map(() =>
      db.insert(carousel).values({ placement: "home" }).onConflictDoNothing().returning(),
    ),
  );
  expect(results.flat()).toHaveLength(1);
  expect(await db.select().from(carousel)).toHaveLength(1);
});

test("CAROUSEL-001 DB가 초안·공개본의 배열 타입·개수·객체 항목을 보호한다", async () => {
  for (const invalid of [null, {}, [1], [null], [[]], Array(11).fill({})]) {
    for (const field of ["draft_slides", "published_slides"] as const) {
      await expect(sql`
        insert into home_carousel (id, placement, ${sql(field)})
        values (${createEntityId()}, 'home', ${JSON.stringify(invalid)}::jsonb)
      `).rejects.toMatchObject({ code: "23514" });
    }
  }
});

test("CAROUSEL-001 DB가 다른 배치·0 이하 버전과 중복 배치를 거절한다", async () => {
  for (const [placement, version] of [
    ["other", 1],
    ["home", 0],
    ["home", -1],
  ] as const) {
    await expect(sql`
      insert into home_carousel (id, placement, lock_version)
      values (${createEntityId()}, ${placement}, ${version})
    `).rejects.toMatchObject({ code: "23514" });
  }
  await db.insert(carousel).values({ placement: "home" });
  await expect(db.insert(carousel).values({ placement: "home" })).rejects.toMatchObject({
    cause: { code: "23505", constraint_name: "home_carousel_placement_key" },
  });
});
