import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";

import { buildAbility } from "../../src/auth/ability";
import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";
import {
  getAdminHomeCarousel,
  getPublicHomeCarousel,
  saveAdminHomeCarouselDraft,
} from "../../src/services/home-carousel-service";

vi.mock("../../src/db", () => ({ getDatabase: () => db }));

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Refusing non-isolated home carousel database");
const sql = postgres(url.toString(), { max: 4 });
const db = drizzle(sql, { schema });
const carousel = schema.homeCarousel;
const admin = (id = createEntityId()) => ({
  user: { id },
  ability: buildAbility({ accountId: id, role: "ADMIN" }),
});
const assetBase = "https://assets.example.test";
const item = {
  name: "홈 안내",
  alt: "응원법 안내",
  href: null,
  isEnabled: false,
  image: {
    url: `${assetBase}/images/home-carousel/${createEntityId()}.webp`,
    width: 1600,
    height: 600,
  },
};
beforeEach(() => vi.stubEnv("ASSETS_PUBLIC_BASE_URL", assetBase));
afterEach(async () => {
  await db.delete(carousel);
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await sql.end();
});

test("CAROUSEL-002 migration은 운영 콘텐츠를 주입하지 않고 최초 구성의 기본값을 보존한다", async () => {
  expect(await db.select().from(carousel)).toEqual([]);
  await expect(getAdminHomeCarousel(admin())).resolves.toMatchObject({
    id: null,
    lockVersion: 0,
    draftSlides: [],
    publishedSlides: [],
  });
  await expect(getPublicHomeCarousel()).resolves.toEqual({ items: [] });
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

test("CAROUSEL-002 두 관리자의 동시 최초 저장은 하나만 성공하고 서버 ID를 발급한다", async () => {
  const results = await Promise.allSettled(
    [admin(), admin()].map((ctx) =>
      saveAdminHomeCarouselDraft(ctx, { expectedLockVersion: 0, items: [item] }),
    ),
  );
  expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  expect(results.find(({ status }) => status === "rejected")).toMatchObject({
    reason: { code: "HOME_CAROUSEL_CONFLICT" },
  });
  expect(await db.select().from(carousel)).toHaveLength(1);
  const saved = await getAdminHomeCarousel(admin());
  expect(saved.lockVersion).toBe(1);
  expect(saved.draftSlides[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  await expect(getPublicHomeCarousel()).resolves.toEqual({ items: [] });
});

test("CAROUSEL-002 같은 버전의 동시 수정은 승자만 남기고 ID·순서를 보존한다", async () => {
  const saved = await saveAdminHomeCarouselDraft(admin(), {
    expectedLockVersion: 0,
    items: [item, { ...item, name: "둘째" }],
  });
  const reversed = [...saved.draftSlides].reverse();
  const { writes } = await sql.begin(async (lock) => {
    await lock.unsafe("select id from home_carousel where placement = $1 for update", ["home"]);
    const writes = Promise.allSettled(
      ["수정 A", "수정 B"].map((name) =>
        saveAdminHomeCarouselDraft(admin(), {
          expectedLockVersion: 1,
          items: [{ ...reversed[0]!, name }, reversed[1]!],
        }),
      ),
    );
    // 두 요청 모두 이전 버전을 읽고 UPDATE에서 대기한 뒤 잠금을 푼다.
    await vi.waitFor(
      async () => {
        const [waiting] = await sql`
        select count(*)::int as count from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock'
          and query like 'update "home_carousel"%'
      `;
        expect(waiting!.count).toBe(2);
      },
      { timeout: 3000 },
    );
    return { writes };
  });
  const results = await writes;
  expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  expect(results.find(({ status }) => status === "rejected")).toMatchObject({
    reason: { code: "HOME_CAROUSEL_CONFLICT" },
  });
  const current = await getAdminHomeCarousel(admin());
  expect(current.lockVersion).toBe(2);
  expect(current.draftSlides.map(({ id }) => id)).toEqual(reversed.map(({ id }) => id));
  await expect(
    saveAdminHomeCarouselDraft(admin(), { expectedLockVersion: 1, items: [] }),
  ).rejects.toMatchObject({ code: "HOME_CAROUSEL_CONFLICT" });
  await expect(getAdminHomeCarousel(admin())).resolves.toEqual(current);
});

test("CAROUSEL-001 임의 ID·다른 host·앨범 경로·비정상 object 이름은 저장을 바꾸지 않는다", async () => {
  const saved = await saveAdminHomeCarouselDraft(admin(), {
    expectedLockVersion: 0,
    items: [item],
  });
  await expect(
    saveAdminHomeCarouselDraft(admin(), {
      expectedLockVersion: 1,
      items: [{ ...item, id: createEntityId() }],
    }),
  ).rejects.toMatchObject({ code: "HOME_CAROUSEL_ITEM_INVALID" });
  for (const url of [
    item.image.url.replace(assetBase, `${assetBase}.evil.test`),
    item.image.url.replace("home-carousel", "albums"),
    `${assetBase}/images/home-carousel/arbitrary.webp`,
  ]) {
    await expect(
      saveAdminHomeCarouselDraft(admin(), {
        expectedLockVersion: 1,
        items: [{ ...item, image: { ...item.image, url } }],
      }),
    ).rejects.toMatchObject({ code: "HOME_CAROUSEL_IMAGE_INVALID" });
  }
  await expect(getAdminHomeCarousel(admin())).resolves.toEqual(saved);
});

test("CAROUSEL-002 초안 편집은 공개본을 보존하고 잘못된 저장 내용을 빈 목록으로 숨기지 않는다", async () => {
  const saved = await saveAdminHomeCarouselDraft(admin(), {
    expectedLockVersion: 0,
    items: [item],
  });
  const published = [
    { id: saved.draftSlides[0]!.id, image: item.image, alt: item.alt, href: null },
  ];
  // 공개 service 이전의 공개본 fixture이며 초안 저장이 이를 바꾸지 않아야 한다.
  await db
    .update(carousel)
    .set({ publishedSlides: published, publishedAt: "2026-11-25T00:00:00Z" });
  await saveAdminHomeCarouselDraft(admin(), {
    expectedLockVersion: 1,
    items: [
      {
        ...saved.draftSlides[0]!,
        name: "교체 준비",
        image: { ...item.image, url: item.image.url.replace("webp", "png") },
      },
    ],
  });
  await expect(getPublicHomeCarousel()).resolves.toEqual({ items: published });
  await sql`update home_carousel set draft_slides = '[{}]'::jsonb`;
  await expect(getAdminHomeCarousel(admin())).rejects.toThrow(
    "Stored home carousel contract violation",
  );
  await expect(getPublicHomeCarousel()).resolves.toEqual({ items: published });
  await sql`update home_carousel set published_slides = '[{}]'::jsonb`;
  await expect(getPublicHomeCarousel()).rejects.toThrow(
    "Stored public home carousel contract violation",
  );
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
