import type { SaveAdminSongLyrics } from "@oioi-bwg/contracts/song";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import * as schema from "@oioi-bwg/server/db/schema";
import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { deleteAlbum } from "@oioi-bwg/server/services/album-service";
import {
  deleteSong,
  editSong,
  getAdminSongEditorBySlug,
  saveSongLyrics,
} from "@oioi-bwg/server/services/song-service";
import {
  importLegacyGuide,
  legacyGuideSourceFingerprint,
  planLegacyGuideImport,
} from "@oioi-bwg/server/services/cheer-guide-import-service";
import { createEntityId } from "@oioi-bwg/server/db/entity-id";

vi.mock("@oioi-bwg/server/db", () => ({ getDatabase: () => database }));

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

test("Domain §8.0 reports referenced Song/Album deletion as expected conflicts without losing rows", async () => {
  const context = { user: { id: accountId }, ability: buildAbility({ accountId, role: "ADMIN" }) };
  await expect(deleteSong(context, songId)).rejects.toMatchObject({
    code: "CONTENT_HAS_CHEER_GUIDE",
  });
  await expect(deleteAlbum(context, albumId)).rejects.toMatchObject({
    code: "CONTENT_HAS_CHEER_GUIDE",
  });
  expect(
    await database.select().from(schema.song).where(eq(schema.song.albumId, albumId)),
  ).toHaveLength(2);
  expect(
    await database.select().from(schema.album).where(eq(schema.album.id, albumId)),
  ).toHaveLength(1);
});

async function writerFixture() {
  const id = createEntityId();
  const [song] = await database
    .insert(schema.song)
    .values({
      id,
      albumId,
      title: "저장 검증",
      slug: `writer-${id}`,
      youtubeId: "timing-video",
      lyrics,
      hasOfficialCheer: true,
    })
    .returning();
  const [guide] = await database
    .insert(schema.cheerGuide)
    .values({
      songId: id,
      mode: "CONCERT",
      legacyWriteTarget: true,
    })
    .returning();
  const [snapshot] = await database
    .insert(schema.cheerGuideSnapshot)
    .values({
      ...snapshotInput(),
      cheerGuideId: guide!.id,
      sourceType: "OFFICIAL",
      sourceUrl: "https://example.invalid/official",
      guideVideoUrl: "https://youtu.be/guide",
    })
    .returning();
  const [publication] = await database
    .insert(schema.cheerGuidePublication)
    .values({
      ...publicationInput(),
      cheerGuideId: guide!.id,
      snapshotId: snapshot!.id,
    })
    .returning();
  await database
    .update(schema.cheerGuide)
    .set({ currentPublicationId: publication!.id })
    .where(eq(schema.cheerGuide.id, guide!.id));
  return {
    song: song!,
    snapshot: snapshot!,
    guideId: guide!.id,
    guideWrite: { guideId: guide!.id, lockVersion: 1 },
    context: { user: { id: accountId }, ability: buildAbility({ accountId, role: "ADMIN" }) },
  };
}
async function writerState(fixture: Awaited<ReturnType<typeof writerFixture>>) {
  return Promise.all([
    database.select().from(schema.song).where(eq(schema.song.id, fixture.song.id)),
    database.select().from(schema.cheerGuide).where(eq(schema.cheerGuide.id, fixture.guideId)),
    database
      .select()
      .from(schema.cheerGuideSnapshot)
      .where(eq(schema.cheerGuideSnapshot.cheerGuideId, fixture.guideId)),
    database
      .select()
      .from(schema.cheerGuidePublication)
      .where(eq(schema.cheerGuidePublication.cheerGuideId, fixture.guideId)),
  ]);
}

test("Domain §8.0 saves exactly one concurrent writer, preserves source and returns the next version", async () => {
  const f = await writerFixture();
  const [otherMode] = await database
    .insert(schema.cheerGuide)
    .values({ songId: f.song.id, mode: "FESTIVAL" })
    .returning();
  const editor = await getAdminSongEditorBySlug(f.context, f.song.slug!);
  expect(editor).toMatchObject({ lyrics, guideWrite: f.guideWrite });
  const changed = [{ ...lyrics[0]!, startTime: 71.825 }];
  const outcomes = await Promise.allSettled(
    [1, 2].map(() =>
      saveSongLyrics(f.context, f.song.id, {
        lyrics: changed,
        youtubeId: f.song.youtubeId!,
        guideWrite: f.guideWrite,
      }),
    ),
  );
  expect(outcomes.filter(({ status }) => status === "fulfilled")).toEqual([
    {
      status: "fulfilled",
      value: { id: f.song.id, guideWrite: { guideId: f.guideId, lockVersion: 2 } },
    },
  ]);
  expect(outcomes.find(({ status }) => status === "rejected")).toMatchObject({
    reason: { code: "CHEER_GUIDE_CONFLICT" },
  });
  const [[shadow], [guide], snapshots, publications] = await writerState(f);
  expect(shadow!.lyrics).toEqual(changed);
  expect(guide!.lockVersion).toBe(2);
  expect(snapshots).toHaveLength(2);
  expect(snapshots.find(({ versionNo }) => versionNo === 2)).toMatchObject({
    lyrics: changed,
    sourceType: "OFFICIAL",
    sourceUrl: f.snapshot.sourceUrl,
    guideVideoUrl: f.snapshot.guideVideoUrl,
    createdByAccountId: accountId,
  });
  expect(
    await database.select().from(schema.cheerGuide).where(eq(schema.cheerGuide.id, otherMode!.id)),
  ).toEqual([otherMode]);
  expect(publications).toHaveLength(2);
  expect(publications.find(({ id }) => id === guide!.currentPublicationId)).toMatchObject({
    publicationNo: 2,
    action: "PUBLISH",
    actorAccountId: accountId,
  });
});

test("Domain §8.0 rejects old tabs, wrong guide, empty content and source/video edits without changes", async () => {
  const f = await writerFixture();
  const before = await writerState(f);
  const cases: [Partial<SaveAdminSongLyrics>, string][] = [
    [{ guideWrite: undefined }, "CHEER_GUIDE_CONFLICT"],
    [{ guideWrite: { guideId: festivalId, lockVersion: 1 } }, "CHEER_GUIDE_CONFLICT"],
    [{ lyrics: [] }, "CHEER_GUIDE_CONTENT_INVALID"],
    [{ youtubeId: "another-video" }, "CHEER_GUIDE_CHANGE_RESTRICTED"],
  ];
  for (const [patch, code] of cases) {
    await expect(
      saveSongLyrics(f.context, f.song.id, {
        lyrics,
        youtubeId: f.song.youtubeId!,
        guideWrite: f.guideWrite,
        ...patch,
      }),
    ).rejects.toMatchObject({ code });
    expect(await writerState(f)).toEqual(before);
  }
  await expect(
    editSong(f.context, f.song.id, {
      albumId,
      title: "수정",
      slug: f.song.slug,
      youtubeId: f.song.youtubeId!,
      hasOfficialCheer: false,
      isTitle: false,
      isVisible: true,
      order: 0,
    }),
  ).rejects.toMatchObject({ code: "CHEER_GUIDE_CHANGE_RESTRICTED" });
  expect(await writerState(f)).toEqual(before);
});

test("Domain §8.0 rolls back LRC history, CAS and shadow when the later slug write fails", async () => {
  const f = await writerFixture();
  const before = await writerState(f);
  const input = {
    albumId,
    title: "수정",
    slug: "changed-immutable-slug",
    youtubeId: f.song.youtubeId!,
    hasOfficialCheer: true,
    isTitle: false,
    isVisible: true,
    order: 0,
    lrcText: "[00:02.12]떼창",
    guideWrite: f.guideWrite,
  };
  await expect(editSong(f.context, f.song.id, input)).rejects.toMatchObject({
    code: "SONG_SLUG_IMMUTABLE",
  });
  expect(await writerState(f)).toEqual(before);
  await editSong(f.context, f.song.id, { ...input, slug: f.song.slug });
  const [[shadow], , snapshots] = await writerState(f);
  expect(shadow!.lyrics).toEqual([
    {
      startTime: 2.12,
      isExtra: false,
      segments: [{ text: "떼창", isCheer: false, isEcho: false }],
    },
  ]);
  expect(snapshots.find(({ versionNo }) => versionNo === 2)!.lyrics).toEqual(shadow!.lyrics);
});

test("Domain §8.0 cannot implicitly republish an unpublished guide", async () => {
  const f = await writerFixture();
  const [publication] = await database
    .insert(schema.cheerGuidePublication)
    .values({
      ...publicationInput(),
      cheerGuideId: f.guideId,
      snapshotId: f.snapshot.id,
      publicationNo: 2,
      action: "UNPUBLISH",
    })
    .returning();
  await database
    .update(schema.cheerGuide)
    .set({ currentPublicationId: publication!.id, lockVersion: 2 })
    .where(eq(schema.cheerGuide.id, f.guideId));
  const before = await writerState(f);
  await expect(
    saveSongLyrics(f.context, f.song.id, {
      lyrics,
      youtubeId: f.song.youtubeId!,
      guideWrite: { guideId: f.guideId, lockVersion: 2 },
    }),
  ).rejects.toMatchObject({ code: "CHEER_GUIDE_CHANGE_RESTRICTED" });
  expect(await writerState(f)).toEqual(before);
});

async function importFixture() {
  const [row] = await database
    .insert(schema.song)
    .values({
      id: createEntityId(),
      albumId,
      title: "이관 검증",
      slug: `import-${createEntityId()}`,
      youtubeId: "timing-video",
      lyrics,
      hasOfficialCheer: null,
    })
    .returning();
  return {
    row: row!,
    context: { user: { id: accountId }, ability: buildAbility({ accountId, role: "ADMIN" }) },
    entry: {
      songId: row!.id,
      guideId: createEntityId(),
      snapshotId: createEntityId(),
      publicationId: createEntityId(),
      sourceFingerprint: legacyGuideSourceFingerprint(row!),
      referenceYoutubeId: row!.youtubeId!,
      mode: "CONCERT" as const,
      legacyWriteTarget: true as const,
      sourceType: "FANDOM" as const,
      sourceUrl: null,
      guideVideoUrl: null,
      description: null,
    },
  };
}

test("Domain §8.0 imports reviewed source once, preserves original JSON and never invents authors", async () => {
  const f = await importFixture();
  const plan = await planLegacyGuideImport(f.context);
  expect(plan.entries.every(({ mode, sourceType }) => mode === null && sourceType === null)).toBe(
    true,
  );
  expect(plan.entries.find(({ songId }) => songId === f.row.id)).toMatchObject({
    sourceFingerprint: f.entry.sourceFingerprint,
  });
  await expect(importLegacyGuide(f.context, f.entry)).resolves.toMatchObject({ status: "ready" });
  expect(
    await database.select().from(schema.cheerGuide).where(eq(schema.cheerGuide.songId, f.row.id)),
  ).toHaveLength(0);
  await expect(importLegacyGuide(f.context, f.entry, true)).resolves.toMatchObject({
    status: "imported",
  });
  await expect(importLegacyGuide(f.context, f.entry, true)).resolves.toMatchObject({
    status: "unchanged",
  });
  const [snapshot] = await database
    .select()
    .from(schema.cheerGuideSnapshot)
    .where(eq(schema.cheerGuideSnapshot.cheerGuideId, f.entry.guideId));
  expect(snapshot).toMatchObject({
    id: f.entry.snapshotId,
    lyrics,
    sourceType: "FANDOM",
    createdByAccountId: null,
  });
  expect(await database.select().from(schema.song).where(eq(schema.song.id, f.row.id))).toEqual([
    f.row,
  ]);
  const publications = await database
    .select()
    .from(schema.cheerGuidePublication)
    .where(eq(schema.cheerGuidePublication.cheerGuideId, f.entry.guideId));
  expect(publications).toHaveLength(1);
  expect(publications[0]).toMatchObject({
    id: f.entry.publicationId,
    actorAccountId: accountId,
    snapshotId: f.entry.snapshotId,
  });
  await saveSongLyrics(f.context, f.row.id, {
    lyrics,
    youtubeId: f.row.youtubeId!,
    guideWrite: { guideId: f.entry.guideId, lockVersion: 1 },
  });
  // Even a content-identical later save is an advanced history, not the original import.
  await expect(importLegacyGuide(f.context, f.entry, true)).rejects.toMatchObject({
    code: "CHEER_GUIDE_IMPORT_CONFLICT",
  });
  expect(
    await database
      .select()
      .from(schema.cheerGuideSnapshot)
      .where(eq(schema.cheerGuideSnapshot.cheerGuideId, f.entry.guideId)),
  ).toHaveLength(2);
});

test("Domain §8.0 serializes import with a pre-import legacy writer without losing either input", async () => {
  const f = await importFixture();
  const changed = [{ ...lyrics[0]!, startTime: 70 }];
  const outcomes = await Promise.allSettled([
    importLegacyGuide(f.context, f.entry, true),
    saveSongLyrics(f.context, f.row.id, { lyrics: changed, youtubeId: f.row.youtubeId! }),
  ]);
  expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  const [shadow] = await database.select().from(schema.song).where(eq(schema.song.id, f.row.id));
  const guides = await database
    .select()
    .from(schema.cheerGuide)
    .where(eq(schema.cheerGuide.songId, f.row.id));
  if (outcomes[0]!.status === "fulfilled") {
    expect(outcomes[1]).toMatchObject({ reason: { code: "CHEER_GUIDE_CONFLICT" } });
    expect(shadow!.lyrics).toEqual(lyrics);
    expect(guides).toHaveLength(1);
    const [snapshot] = await database
      .select()
      .from(schema.cheerGuideSnapshot)
      .where(eq(schema.cheerGuideSnapshot.id, f.entry.snapshotId));
    expect(snapshot!.lyrics).toEqual(lyrics);
  } else {
    expect(outcomes[0]).toMatchObject({ reason: { code: "CHEER_GUIDE_IMPORT_CONFLICT" } });
    expect(shadow!.lyrics).toEqual(changed);
    expect(guides).toHaveLength(0);
  }
});

test("Domain §8.0 rejects changed source fingerprints and conflicting mapping IDs without partial history", async () => {
  const f = await importFixture();
  await database
    .update(schema.song)
    .set({ youtubeId: "changed" })
    .where(eq(schema.song.id, f.row.id));
  await expect(importLegacyGuide(f.context, f.entry, true)).rejects.toMatchObject({
    code: "CHEER_GUIDE_IMPORT_CONFLICT",
  });
  expect(
    await database.select().from(schema.cheerGuide).where(eq(schema.cheerGuide.songId, f.row.id)),
  ).toHaveLength(0);
  await database
    .update(schema.song)
    .set({ youtubeId: f.row.youtubeId })
    .where(eq(schema.song.id, f.row.id));
  await importLegacyGuide(f.context, f.entry, true);
  await expect(
    importLegacyGuide(f.context, { ...f.entry, snapshotId: createEntityId() }, true),
  ).rejects.toMatchObject({ code: "CHEER_GUIDE_IMPORT_CONFLICT" });
  expect(
    await database
      .select()
      .from(schema.cheerGuideSnapshot)
      .where(eq(schema.cheerGuideSnapshot.cheerGuideId, f.entry.guideId)),
  ).toHaveLength(1);
});
