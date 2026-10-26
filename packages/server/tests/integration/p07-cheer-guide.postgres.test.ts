import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, expect, test } from "vitest";

import * as schema from "@oioi-bwg/server/db/schema";

function isolatedUrl(value: string | undefined) {
  const url = new URL(value ?? "http://invalid");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
  )
    throw new Error("Isolated local PostgreSQL integration database required");
  return url;
}
const url = isolatedUrl(process.env.DATABASE_URL);
const ownerUrl = isolatedUrl(process.env.M7_TEST_POSTGRES_VERIFICATION_URL);
if (url.host !== ownerUrl.host || url.pathname !== ownerUrl.pathname) {
  throw new Error("Verification connection must target the same isolated database");
}
const client = postgres(url.toString(), { max: 4, connection: { statement_timeout: 10_000 } });
const owner = postgres(ownerUrl.toString(), { max: 1, connection: { statement_timeout: 10_000 } });
const database = drizzle(client, { schema });
afterAll(async () => {
  await client.end();
  await owner.end();
});

const lyrics = [
  {
    startTime: 72.125,
    isExtra: true,
    segments: [{ text: "네임콜", isCheer: true, isEcho: false, startTimeOffset: 0.125 }],
  },
];
let accountId: string;
let albumId: string;
let songId: string;
let concertId: string;
let festivalId: string;
let concertSnapshotId: string;
let festivalSnapshotId: string;
let concertPublicationId: string;
let festivalPublicationId: string;

beforeAll(async () => {
  const [account] = await database
    .insert(schema.account)
    .values({ role: "ADMIN", status: "ACTIVE" })
    .returning();
  accountId = account!.id;
  const [album] = await database
    .insert(schema.album)
    .values({
      name: "P07",
      slug: "p07-constraints",
      imgUrl: "https://example.invalid/cover.webp",
      color: "#123456",
    })
    .returning();
  albumId = album!.id;
  const [song] = await database
    .insert(schema.song)
    .values({ albumId, slug: "p07-original", youtubeId: "timing-video", lyrics })
    .returning();
  songId = song!.id;
  const guides = await database
    .insert(schema.cheerGuide)
    .values([
      { songId, mode: "CONCERT", legacyWriteTarget: true },
      { songId, mode: "FESTIVAL" },
    ])
    .returning();
  [concertId, festivalId] = guides.map(({ id }) => id) as [string, string];
  const snapshots = await database
    .insert(schema.cheerGuideSnapshot)
    .values([
      {
        ...snapshotInput(),
        sourceType: "OFFICIAL",
        sourceUrl: "https://example.invalid/official",
        createdByAccountId: accountId,
      },
      { ...snapshotInput(), cheerGuideId: festivalId },
    ])
    .returning();
  [concertSnapshotId, festivalSnapshotId] = snapshots.map(({ id }) => id) as [string, string];
  const publications = await database
    .insert(schema.cheerGuidePublication)
    .values([
      publicationInput(),
      { ...publicationInput(), cheerGuideId: festivalId, snapshotId: festivalSnapshotId },
    ])
    .returning();
  [concertPublicationId, festivalPublicationId] = publications.map(({ id }) => id) as [
    string,
    string,
  ];
  await database
    .update(schema.cheerGuide)
    .set({ currentPublicationId: concertPublicationId })
    .where(eq(schema.cheerGuide.id, concertId));
  await database
    .update(schema.cheerGuide)
    .set({ currentPublicationId: festivalPublicationId })
    .where(eq(schema.cheerGuide.id, festivalId));
});

function snapshotInput(): typeof schema.cheerGuideSnapshot.$inferInsert {
  return {
    cheerGuideId: concertId,
    versionNo: 1,
    lyrics,
    referenceYoutubeId: "timing-video",
    sourceType: "FANDOM",
    changeSummary: "기존 응원법 이관",
  };
}
function publicationInput(): typeof schema.cheerGuidePublication.$inferInsert {
  return {
    cheerGuideId: concertId,
    publicationNo: 1,
    action: "PUBLISH",
    snapshotId: concertSnapshotId,
    actorAccountId: accountId,
    reason: "기존 공개 상태 보존",
  };
}

test("Domain §8.0 preserves UUIDv7, complete lyrics, and independent source per mode", async () => {
  const snapshots = await database
    .select()
    .from(schema.cheerGuideSnapshot)
    .where(eq(schema.cheerGuideSnapshot.cheerGuideId, concertId));
  expect(snapshots[0]).toMatchObject({
    lyrics,
    sourceType: "OFFICIAL",
    createdByAccountId: accountId,
  });
  const [festival] = await database
    .select()
    .from(schema.cheerGuideSnapshot)
    .where(eq(schema.cheerGuideSnapshot.id, festivalSnapshotId));
  expect(festival).toMatchObject({
    sourceType: "FANDOM",
    sourceUrl: null,
    createdByAccountId: null,
  });
  for (const id of [concertId, festivalId, concertSnapshotId, concertPublicationId]) {
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
});

test("Domain §8.0 concurrent duplicate modes allow one winner; one legacy writer target per song", async () => {
  const [song] = await database
    .insert(schema.song)
    .values({ albumId, slug: "p07-duplicate-mode" })
    .returning();
  const results = await Promise.allSettled(
    [0, 1].map(() =>
      database.insert(schema.cheerGuide).values({ songId: song!.id, mode: "CONCERT" }),
    ),
  );
  expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  expect(results.find(({ status }) => status === "rejected")).toMatchObject({
    reason: { cause: { code: "23505", constraint_name: "cheer_guide_song_id_mode_key" } },
  });
  await expect(
    database
      .update(schema.cheerGuide)
      .set({ legacyWriteTarget: true })
      .where(eq(schema.cheerGuide.id, festivalId)),
  ).rejects.toMatchObject({
    cause: { code: "23505", constraint_name: "cheer_guide_song_id_legacy_write_target_key" },
  });
});

test("Domain §8.0 rejects cross-guide snapshot and current publication references", async () => {
  await expect(
    database
      .insert(schema.cheerGuidePublication)
      .values({ ...publicationInput(), publicationNo: 2, snapshotId: festivalSnapshotId }),
  ).rejects.toMatchObject({
    cause: {
      code: "23503",
      constraint_name: "cheer_guide_publication_cheer_guide_id_snapshot_id_fkey",
    },
  });
  await expect(
    database
      .update(schema.cheerGuide)
      .set({ currentPublicationId: festivalPublicationId })
      .where(eq(schema.cheerGuide.id, concertId)),
  ).rejects.toMatchObject({
    cause: { code: "23503", constraint_name: "cheer_guide_id_current_publication_id_fkey" },
  });
});

test("Domain §8.0 requires official provenance, array lyrics, timing reference, and positive sequence numbers", async () => {
  const invalid: [Partial<typeof schema.cheerGuideSnapshot.$inferInsert>, string][] = [
    [{ sourceType: "OFFICIAL", sourceUrl: null }, "source_url"],
    [{ sourceType: "OFFICIAL", sourceUrl: "   " }, "source_url"],
    [{ lyrics: {} }, "lyrics"],
    [{ referenceYoutubeId: " " }, "reference_youtube_id"],
    [{ changeSummary: " " }, "change_summary"],
    [{ versionNo: 0 }, "version_no"],
  ];
  for (const [patch, field] of invalid) {
    await expect(
      database
        .insert(schema.cheerGuideSnapshot)
        .values({ ...snapshotInput(), versionNo: 2, ...patch }),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: `cheer_guide_snapshot_${field}_check` },
    });
  }
  await expect(
    database.insert(schema.cheerGuideSnapshot).values(snapshotInput()),
  ).rejects.toMatchObject({
    cause: { code: "23505", constraint_name: "cheer_guide_snapshot_cheer_guide_id_version_no_key" },
  });
  await expect(
    database.insert(schema.cheerGuidePublication).values(publicationInput()),
  ).rejects.toMatchObject({
    cause: {
      code: "23505",
      constraint_name: "cheer_guide_publication_cheer_guide_id_publication_no_key",
    },
  });
  await expect(
    client`update cheer_guide set lock_version = 0 where id = ${concertId}`,
  ).rejects.toMatchObject({ code: "23514", constraint_name: "cheer_guide_lock_version_check" });
  await expect(
    client`update cheer_guide set mode = 'FAN' where id = ${festivalId}`,
  ).rejects.toMatchObject({ code: "23514", constraint_name: "cheer_guide_mode_check" });
});

test("Domain §8.0 preserves history on UPDATE, DELETE, and owner TRUNCATE including zero matched rows", async () => {
  for (const table of ["cheer_guide_snapshot", "cheer_guide_publication"]) {
    for (const statement of [
      `update ${table} set id = id`,
      `update ${table} set id = id where false`,
      `delete from ${table}`,
      `delete from ${table} where false`,
    ])
      await expect(client.unsafe(statement)).rejects.toMatchObject({ code: "55000" });
    await expect(owner.unsafe(`truncate ${table} cascade`)).rejects.toMatchObject({
      code: "55000",
    });
  }
  expect(
    await database
      .select()
      .from(schema.cheerGuidePublication)
      .where(eq(schema.cheerGuidePublication.id, concertPublicationId)),
  ).toHaveLength(1);
});

test("Domain §8.0 retains referenced account, guide, song and album; hide remains available", async () => {
  for (const [table, id] of [
    ["account", accountId],
    ["cheer_guide", concertId],
    ["song", songId],
    ["album", albumId],
  ])
    await expect(client.unsafe(`delete from ${table} where id = $1`, [id!])).rejects.toMatchObject({
      code: "23503",
    });
  await database.update(schema.song).set({ isVisible: false }).where(eq(schema.song.id, songId));
  await expect(
    database
      .select({ visible: schema.song.isVisible })
      .from(schema.song)
      .where(eq(schema.song.id, songId)),
  ).resolves.toEqual([{ visible: false }]);
});

test("Domain §8.0 inserts a separate UNPUBLISH record and rolls back a failed pointer transaction", async () => {
  await database.transaction(async (tx) => {
    const [publication] = await tx
      .insert(schema.cheerGuidePublication)
      .values({ ...publicationInput(), publicationNo: 2, action: "UNPUBLISH", reason: "공개 중단" })
      .returning();
    await tx
      .update(schema.cheerGuide)
      .set({ currentPublicationId: publication!.id, lockVersion: 2 })
      .where(eq(schema.cheerGuide.id, concertId));
  });
  const [before] = await database
    .select()
    .from(schema.cheerGuide)
    .where(eq(schema.cheerGuide.id, concertId));
  await expect(
    database.transaction(async (tx) => {
      await tx.insert(schema.cheerGuideSnapshot).values({ ...snapshotInput(), versionNo: 2 });
      await tx
        .insert(schema.cheerGuidePublication)
        .values({ ...publicationInput(), publicationNo: 3 });
      await tx
        .update(schema.cheerGuide)
        .set({ currentPublicationId: festivalPublicationId, lockVersion: 3 })
        .where(eq(schema.cheerGuide.id, concertId));
    }),
  ).rejects.toMatchObject({ cause: { code: "23503" } });
  await expect(
    database.select().from(schema.cheerGuide).where(eq(schema.cheerGuide.id, concertId)),
  ).resolves.toEqual([before]);
  await expect(
    database
      .select()
      .from(schema.cheerGuideSnapshot)
      .where(eq(schema.cheerGuideSnapshot.cheerGuideId, concertId)),
  ).resolves.toHaveLength(1);
  await expect(
    database
      .select()
      .from(schema.cheerGuidePublication)
      .where(eq(schema.cheerGuidePublication.cheerGuideId, concertId)),
  ).resolves.toHaveLength(2);
});
