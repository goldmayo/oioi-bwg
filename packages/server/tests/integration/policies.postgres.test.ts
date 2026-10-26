import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, max } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";
import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";
import { findLatestPublishedPolicies } from "../../src/repositories/policy-repository";
const p = schema.servicePolicy;
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Refusing non-isolated policy database");
const sql = postgres(url.toString(), { max: 2 });
const db = drizzle(sql, { schema });
const ids: string[] = [];
afterAll(async () => {
  if (ids.length) await db.delete(p).where(inArray(p.id, ids));
  await sql.end();
});
test("기존 다섯 안내의 본문·시행일·설명·하단 안내를 원문과 동일하게 보존한다", async () => {
  const rows = await db.select().from(p).where(eq(p.version, 1));
  const slugs = ["privacy", "terms", "copyright", "email", "ga"];
  const content = slugs.map((slug) => {
    const row = rows.find((item) => item.slug === slug)!;
    expect(row.isPublished).toBe(true);
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      effectiveOn: row.effectiveOn,
      content: row.content,
      changeNotice: row.changeNotice,
    };
  });
  expect(rows).toHaveLength(5);
  // migration_main@f4efc1a의 고정 원문에서 구한 값이며 SQL의 재계산 결과가 아니다.
  expect(createHash("sha256").update(JSON.stringify(content)).digest("hex")).toBe(
    "db6e8c1d270c299909a0c4527252feac5127d423f744173ad9094866b4d4847d",
  );
});
test("공개 최신 버전만 선택하고 미공개 개정본과 과거 본문은 보존한다", async () => {
  const [original] = await findLatestPublishedPolicies(db, "privacy");
  const [highest] = await db
    .select({ version: max(p.version) })
    .from(p)
    .where(eq(p.slug, "privacy"));
  const nextVersion = highest!.version! + 1;
  const created = await db
    .insert(p)
    .values([
      {
        ...original!,
        id: createEntityId(),
        version: nextVersion,
        content: ["공개 개정"],
        isPublished: true,
      },
      {
        ...original!,
        id: createEntityId(),
        version: nextVersion + 1,
        content: ["검토 전 시안"],
        isPublished: false,
      },
    ])
    .returning();
  ids.push(...created.map((row) => row.id));
  const [current] = await findLatestPublishedPolicies(db, "privacy");
  expect(current).toMatchObject({ version: nextVersion, content: ["공개 개정"] });
  expect(await findLatestPublishedPolicies(db)).toHaveLength(5);
  expect(await findLatestPublishedPolicies(db, "toString")).toEqual([]);
  const [old] = await db.select().from(p).where(eq(p.id, original!.id));
  expect(old!.content).toEqual(original!.content);
});
test("DB가 경로·양의 버전·본문 타입·중복 버전을 제한한다", async () => {
  for (const [slug, version, content] of [
    ["toString", 9, ["본문"]],
    ["privacy", 0, ["본문"]],
    ["privacy", 9, []],
    ["privacy", 9, "본문"],
    ["privacy", 9, [1]],
  ] as const) {
    await expect(
      sql`insert into service_policy (id,slug,version,title,description,effective_on,content) values (${createEntityId()},${slug},${version},'검증','설명','2099-01-01',${JSON.stringify(content)}::jsonb)`,
    ).rejects.toMatchObject({ code: "23514" });
  }
  await expect(
    sql`insert into service_policy (id,slug,version,title,description,effective_on,content) values (${createEntityId()},'terms',1,'검증','설명','2099-01-01','["중복"]'::jsonb)`,
  ).rejects.toMatchObject({ code: "23505", constraint_name: "service_policy_slug_version_key" });
});

test("작성한 개정안 다섯 건은 비공개 초안이며 기존 공개본을 대체하지 않는다", async () => {
  const drafts = await db.select().from(p).where(eq(p.version, 2));
  expect(drafts).toHaveLength(5);
  expect(drafts.every((row) => !row.isPublished)).toBe(true);
  expect((await findLatestPublishedPolicies(db, "terms"))[0]!.version).toBe(1);
});
