import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import type { RequestContext } from "@/server/auth/request-context";
import { buildAbility } from "@/server/auth/ability";
import { getDatabase } from "@/server/db";
import { emailVerificationChallenge, song } from "@/server/db/schema";
import { toErrorResponse } from "@/server/http/api-response";
import * as identity from "@/server/repositories/auth-repository";
import { findChallengeById } from "@/server/repositories/email-verification-repository";
import * as albums from "@/server/services/album-service";
import { requestOtp, verifyOtp } from "@/server/services/email-verification-service";
import { completeSignup } from "@/server/services/signup-service";
import * as songs from "@/server/services/song-service";
import type { SaveAdminAlbum } from "@/shared/contracts/album";
import type { CreateAdminSong } from "@/shared/contracts/song";

const external = vi.hoisted(() => ({ mail: vi.fn() }));

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("../../src/server/email/signup-verification-email", () => ({
  sendSignupVerificationEmail: external.mail,
  SignupEmailSuppressedError: class extends Error {},
}));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const verificationUrl = process.env.M7_TEST_POSTGRES_VERIFICATION_URL;
if (!verificationUrl) throw new Error("M7_TEST_POSTGRES_VERIFICATION_URL is required");

const parsedDatabaseUrl = new URL(databaseUrl);
if (
  !new Set(["localhost", "127.0.0.1"]).has(parsedDatabaseUrl.hostname) ||
  !parsedDatabaseUrl.pathname.startsWith("/oioi_m7_test_")
) {
  throw new Error("Refusing a non-isolated PostgreSQL integration database");
}

const database = getDatabase();
const sql = postgres(databaseUrl, {
  max: 6,
  connection: { statement_timeout: 10_000 },
});
const verificationSql = postgres(verificationUrl, {
  max: 1,
  connection: { statement_timeout: 10_000 },
});
const admin: RequestContext = {
  user: { id: "1" },
  ability: buildAbility({ accountId: "1", role: "ADMIN" }),
};

function albumInput(slug: string): SaveAdminAlbum {
  return {
    color: "#000000",
    imgUrl: `https://example.invalid/${slug}.webp`,
    isVisible: true,
    name: slug,
    releaseDate: null,
    slug,
  };
}

function songInput(albumId: number, slug: string, order = 1): CreateAdminSong {
  return {
    albumId,
    hasOfficialCheer: false,
    isTitle: false,
    isVisible: true,
    lrcText: "[00:01.00]가사",
    order,
    slug,
    title: slug,
    youtubeId: "abcdefghijk",
  };
}

function requestContext(role: "USER" | "REVIEWER" | null): RequestContext {
  if (role === null) {
    return { user: null, ability: buildAbility({ accountId: null, role: null }) };
  }

  return {
    user: { id: "2" },
    ability: buildAbility({ accountId: "2", role }),
  };
}

async function issueVerifiedChallenge(email: string, ipAddress: string) {
  external.mail.mockReset();
  external.mail.mockResolvedValue({ mode: "dev" });

  const { challengeId } = await requestOtp(email, ipAddress);
  await expect(findChallengeById(database, challengeId)).resolves.toMatchObject({
    status: "PENDING",
    verifiedAt: null,
  });

  const otp = external.mail.mock.calls.at(-1)?.[1];
  expect(otp).toEqual(expect.stringMatching(/^\d{6}$/));
  await verifyOtp(challengeId, otp as string);
  await expect(findChallengeById(database, challengeId)).resolves.toMatchObject({
    status: "VERIFIED",
    consumedAt: null,
  });
  return challengeId;
}

async function expectPublicConflict(error: unknown, code: string) {
  expect(error).toMatchObject({ code });
  const response = toErrorResponse(error);
  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toMatchObject({ code });
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitForBlockedAdvisoryLocks(expected: number) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const [row] = await sql<{ count: number }[]>`
      select count(*)::int as count
      from pg_locks
      where locktype = 'advisory'
        and not granted
        and database = (select oid from pg_database where datname = current_database())
    `;
    if ((row?.count ?? 0) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Expected ${expected} blocked advisory locks`);
}

async function requestConcurrentPair(email: string, ipAddress: string) {
  const holderReady = createDeferred();
  const releaseHolder = createDeferred();
  const lockKey = `oioi-bwg:signup-otp:${email.trim().toLowerCase()}`;

  const holder = sql.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    holderReady.resolve();
    await releaseHolder.promise;
  });

  await holderReady.promise;
  const results = Promise.allSettled([requestOtp(email, ipAddress), requestOtp(email, ipAddress)]);

  try {
    await waitForBlockedAdvisoryLocks(2);
  } finally {
    releaseHolder.resolve();
    await holder;
  }

  return results;
}

function expectOneSuccessAndOneCooldown(results: PromiseSettledResult<unknown>[]) {
  expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
  expect(results.find(({ status }) => status === "rejected")).toMatchObject({
    reason: { code: "OTP_COOLDOWN" },
  });
}

async function expectWinnerRateCounts(email: string, ipAddress: string) {
  expect(
    await sql`
      select scope, key, request_count
      from email_verification_rate_limit
      where (scope = 'EMAIL' and key = ${email})
         or (scope = 'IP' and key = ${ipAddress})
      order by scope
    `,
  ).toEqual([
    { scope: "EMAIL", key: email, request_count: 1 },
    { scope: "IP", key: ipAddress, request_count: 1 },
  ]);
}

beforeAll(async () => {
  const [version] = await sql<{ server_version_num: string }[]>`show server_version_num`;
  expect(Math.floor(Number(version?.server_version_num) / 10_000)).toBe(17);
});

afterAll(async () => {
  await sql.end();
  await verificationSql.end();
  await database.$client.end();
});

describe.sequential("M7 auth, signup, and OTP PostgreSQL regressions", () => {
  test("AUTH-T001 completes signup, consumes the challenge, and rejects replay", async () => {
    const email = "m7-signup-success@example.invalid";
    const nickname = "m7-signup-success";
    const challengeId = await issueVerifiedChallenge(email, "127.10.0.1");

    const result = await completeSignup(challengeId, "LocalTest!12345", nickname);
    await expect(findChallengeById(database, challengeId)).resolves.toMatchObject({
      status: "CONSUMED",
      verifiedAt: null,
      consumedAt: expect.any(String),
    });
    expect(
      await sql`
        select account.status, profile.nickname, credential.email, credential.email_verified_at
        from account
        join profile on profile.account_id = account.id
        join password_credential credential on credential.account_id = account.id
        where account.id = ${result.accountId}
      `,
    ).toEqual([
      {
        status: "ACTIVE",
        nickname,
        email,
        email_verified_at: expect.any(Date),
      },
    ]);

    const accountCount = await sql`select count(*)::int as count from account`;
    await expect(
      completeSignup(challengeId, "LocalTest!12345", "m7-signup-replay"),
    ).rejects.toMatchObject({ code: "OTP_NOT_VERIFIED" });
    expect(await sql`select count(*)::int as count from account`).toEqual(accountCount);
  });

  test("rolls back a nickname conflict and maps the real constraint to 409", async () => {
    const [existing] = await identity.insertAccount(database);
    expect(existing).toBeDefined();
    await identity.insertProfile(database, existing!.id, "m7-existing-nickname");

    const challengeId = await issueVerifiedChallenge(
      "m7-nickname-conflict@example.invalid",
      "127.10.0.2",
    );
    const accountCount = await sql`select count(*)::int as count from account`;
    const error = await completeSignup(
      challengeId,
      "LocalTest!12345",
      "m7-existing-nickname",
    ).catch((cause: unknown) => cause);

    await expectPublicConflict(error, "NICKNAME_ALREADY_REGISTERED");
    await expect(findChallengeById(database, challengeId)).resolves.toMatchObject({
      status: "VERIFIED",
      consumedAt: null,
    });
    expect(await sql`select count(*)::int as count from account`).toEqual(accountCount);
  });

  test("rolls back a credential conflict and maps the real constraint to 409", async () => {
    const email = "m7-existing-email@example.invalid";
    const [existing] = await identity.insertAccount(database);
    expect(existing).toBeDefined();
    await identity.insertProfile(database, existing!.id, "m7-email-owner");
    await identity.insertPasswordCredential(database, {
      accountId: existing!.id,
      email,
      emailVerifiedAt: new Date().toISOString(),
      passwordChangedAt: new Date().toISOString(),
      passwordHash: "integration-test-hash",
    });

    const challengeId = await issueVerifiedChallenge(email, "127.10.0.3");
    const accountCount = await sql`select count(*)::int as count from account`;
    const error = await completeSignup(
      challengeId,
      "LocalTest!12345",
      "m7-rolled-back-profile",
    ).catch((cause: unknown) => cause);

    await expectPublicConflict(error, "EMAIL_ALREADY_REGISTERED");
    await expect(findChallengeById(database, challengeId)).resolves.toMatchObject({
      status: "VERIFIED",
      consumedAt: null,
    });
    expect(await sql`select count(*)::int as count from account`).toEqual(accountCount);
    expect(
      await sql`select count(*)::int as count from profile where nickname = 'm7-rolled-back-profile'`,
    ).toEqual([{ count: 0 }]);
  });

  test("serializes concurrent first OTP requests", async () => {
    const email = "m7-otp-first@example.invalid";
    const ipAddress = "127.10.1.1";
    external.mail.mockReset();
    external.mail.mockResolvedValue({ mode: "dev" });

    const results = await requestConcurrentPair(email, ipAddress);

    expectOneSuccessAndOneCooldown(results);
    expect(external.mail).toHaveBeenCalledTimes(1);
    expect(
      await sql`
        select status, count(*)::int as count
        from email_verification_challenge
        where email = ${email}
        group by status
      `,
    ).toEqual([{ status: "PENDING", count: 1 }]);
    await expectWinnerRateCounts(email, ipAddress);
  });

  test("serializes concurrent OTP reissues", async () => {
    const email = "m7-otp-reissue@example.invalid";
    const ipAddress = "127.10.1.2";
    const oldTime = new Date(Date.now() - 61_000).toISOString();
    external.mail.mockReset();
    external.mail.mockResolvedValue({ mode: "dev" });
    await database.insert(emailVerificationChallenge).values({
      createdAt: oldTime,
      email,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ipAddress,
      lastSentAt: oldTime,
      otpHash: "integration-test-hash",
      status: "PENDING",
    });

    const results = await requestConcurrentPair(email, ipAddress);

    expectOneSuccessAndOneCooldown(results);
    expect(external.mail).toHaveBeenCalledTimes(1);
    expect(
      await sql`
        select status, count(*)::int as count
        from email_verification_challenge
        where email = ${email}
        group by status
        order by status
      `,
    ).toEqual([
      { status: "INVALIDATED", count: 1 },
      { status: "PENDING", count: 1 },
    ]);
    await expectWinnerRateCounts(email, ipAddress);
  });
});

describe.sequential("M7 content, authorization, and persistence PostgreSQL regressions", () => {
  test("applies tracked migrations 0000 through 0004 with exact hashes", async () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { tag: string }[];
    };
    const rows = await verificationSql<{ hash: string }[]>`
      select hash from drizzle.__drizzle_migrations order by id
    `;

    expect(journal.entries.map(({ tag }) => tag)).toEqual([
      "0000_long_matthew_murdock",
      "0001_concerned_vapor",
      "0002_email_verification_challenge",
      "0003_email_verification_rate_limit",
      "0004_violet_deadpool",
    ]);
    expect(rows.map(({ hash }) => hash)).toEqual(
      journal.entries.map(({ tag }) =>
        createHash("sha256")
          .update(readFileSync(`drizzle/${tag}.sql`))
          .digest("hex"),
      ),
    );
  });

  test("maps real Album and Song slug constraints to public 409 conflicts", async () => {
    const existingAlbum = await albums.createAlbum(admin, albumInput("m7-conflict-album"));
    const createAlbumError = await albums
      .createAlbum(admin, albumInput("m7-conflict-album"))
      .catch((cause: unknown) => cause);
    await expectPublicConflict(createAlbumError, "ALBUM_SLUG_ALREADY_EXISTS");

    const otherAlbum = await albums.createAlbum(admin, albumInput("m7-other-album"));
    const editAlbumError = await albums
      .editAlbum(admin, otherAlbum.id, albumInput(existingAlbum.slug))
      .catch((cause: unknown) => cause);
    await expectPublicConflict(editAlbumError, "ALBUM_SLUG_ALREADY_EXISTS");

    await songs.createSong(admin, songInput(existingAlbum.id, "m7-conflict-song"));
    const createSongError = await songs
      .createSong(admin, songInput(otherAlbum.id, "m7-conflict-song"))
      .catch((cause: unknown) => cause);
    await expectPublicConflict(createSongError, "SONG_SLUG_ALREADY_EXISTS");

    await database.insert(song).values([
      { albumId: existingAlbum.id, slug: null },
      { albumId: otherAlbum.id, slug: null },
    ]);
    expect(await sql`select id from "Song" where slug is null`).toHaveLength(2);
  });

  test("denies guest, USER, and REVIEWER at every privileged Album/Song Service", async () => {
    const before = await sql`
      select
        (select count(*)::int from "Album") as albums,
        (select count(*)::int from "Song") as songs
    `;

    for (const role of [null, "USER", "REVIEWER"] as const) {
      const context = requestContext(role);
      const code = role === null ? "UNAUTHENTICATED" : "FORBIDDEN";
      const operations = [
        () => albums.listAdminAlbums(context),
        () => albums.createAlbum(context, albumInput("m7-denied-album")),
        () => albums.editAlbum(context, 1, albumInput("m7-denied-album")),
        () => albums.deleteAlbum(context, 1),
        () => songs.listAdminSongs(context),
        () => songs.getAdminSongEditorBySlug(context, "m7-denied-song"),
        () => songs.createSong(context, songInput(1, "m7-denied-song")),
        () => songs.editSong(context, 1, { ...songInput(1, "m7-denied-song"), lrcText: "" }),
        () => songs.deleteSong(context, 1),
        () => songs.saveSongLyrics(context, 1, { lyrics: [], youtubeId: "abcdefghijk" }),
      ];

      for (const operation of operations) {
        await expect(Promise.resolve().then(operation)).rejects.toMatchObject({ code });
      }
    }

    expect(
      await sql`
        select
          (select count(*)::int from "Album") as albums,
          (select count(*)::int from "Song") as songs
      `,
    ).toEqual(before);
  });

  test("preserves FK rollback, public visibility/order/lyrics, and Album cascade", async () => {
    const visibleAlbum = await albums.createAlbum(admin, albumInput("m7-public-album"));
    const hiddenAlbum = await albums.createAlbum(admin, {
      ...albumInput("m7-hidden-album"),
      isVisible: false,
    });
    const lyrics = [
      {
        isExtra: false,
        segments: [{ isCheer: false, isEcho: false, text: "검증" }],
        startTime: 1,
      },
    ];

    await database.insert(song).values([
      {
        albumId: visibleAlbum.id,
        isVisible: true,
        lyrics,
        order: 2,
        slug: "m7-public-second",
        title: "Second",
        youtubeId: "abcdefghijk",
      },
      {
        albumId: visibleAlbum.id,
        isVisible: true,
        lyrics,
        order: 1,
        slug: "m7-public-first",
        title: "First",
        youtubeId: "abcdefghijk",
      },
      {
        albumId: visibleAlbum.id,
        isVisible: false,
        order: 0,
        slug: "m7-hidden-song",
        title: "Hidden",
        youtubeId: "abcdefghijk",
      },
      {
        albumId: hiddenAlbum.id,
        isVisible: true,
        order: 1,
        slug: "m7-hidden-parent-song",
        title: "Hidden parent",
        youtubeId: "abcdefghijk",
      },
    ]);

    await expect(albums.getAlbumDetailBySlug("m7-public-album")).resolves.toMatchObject({
      songs: [{ slug: "m7-public-first" }, { slug: "m7-public-second" }],
    });
    await expect(songs.getSongDetailBySlug("m7-public-first")).resolves.toMatchObject({
      lyrics,
    });
    await expect(songs.getSongDetailBySlug("m7-hidden-song")).resolves.toBeUndefined();
    await expect(songs.getSongDetailBySlug("m7-hidden-parent-song")).resolves.toBeUndefined();

    await expect(
      database.transaction(async (transaction) => {
        await transaction.insert(song).values({
          albumId: visibleAlbum.id,
          slug: "m7-fk-rollback-first",
        });
        await transaction.insert(song).values({ albumId: 2_147_483_647 });
      }),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
    expect(await sql`select id from "Song" where slug = 'm7-fk-rollback-first'`).toHaveLength(0);

    await albums.deleteAlbum(admin, visibleAlbum.id);
    expect(await sql`select id from "Song" where "albumId" = ${visibleAlbum.id}`).toHaveLength(0);
  });
});
