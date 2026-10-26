import "server-only";

import { createHash } from "node:crypto";
import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { lyricsDataSchema } from "@oioi-bwg/contracts/song";
import { z } from "zod";
import { type RequestContext, requireUser } from "../auth/request-context";
import { getDatabase } from "../db";
import { createEntityId } from "../db/entity-id";
import { AppError } from "../errors/app-error";
import { findAuthorizationFactsByAccountId } from "../repositories/auth-repository";
import {
  findGuideImportState,
  findLegacyGuideCandidates,
  insertImportedGuide,
} from "../repositories/cheer-guide-import-repository";
import { lockSongForGuideWrite } from "../repositories/cheer-guide-repository";

const webUrl = z.url({ protocol: /^https?$/ });
export const legacyGuideImportEntrySchema = z
  .object({
    title: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    songId: entityIdSchema,
    guideId: entityIdSchema,
    snapshotId: entityIdSchema,
    publicationId: entityIdSchema,
    sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    mode: z.enum(["CONCERT", "FESTIVAL"]),
    legacyWriteTarget: z.literal(true),
    sourceType: z.enum(["OFFICIAL", "FANDOM"]),
    sourceUrl: webUrl.nullable(),
    guideVideoUrl: webUrl.nullable(),
    description: z.string().trim().min(1).nullable(),
    referenceYoutubeId: z.string().trim().min(1),
  })
  .strict()
  .refine((entry) => entry.sourceType !== "OFFICIAL" || entry.sourceUrl !== null, {
    path: ["sourceUrl"],
    message: "공식 응원법의 원본 링크가 필요합니다.",
  });
export const legacyGuideImportManifestSchema = z
  .object({
    version: z.literal(1),
    excludedSongIds: z.array(entityIdSchema).optional(),
    entries: z.array(legacyGuideImportEntrySchema).min(1),
  })
  .strict()
  .superRefine(({ entries }, ctx) => {
    const ids = new Set<string>();
    entries.forEach((entry, index) => {
      for (const id of [entry.songId, entry.guideId, entry.snapshotId, entry.publicationId]) {
        if (ids.has(id))
          ctx.addIssue({
            code: "custom",
            path: ["entries", index],
            message: "중복된 이관 ID입니다.",
          });
        ids.add(id);
      }
    });
  });
export type LegacyGuideImportEntry = z.infer<typeof legacyGuideImportEntrySchema>;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, child]) => [key, canonical(child)]),
    );
  return value;
}
export function legacyGuideSourceFingerprint(row: {
  lyrics: unknown;
  youtubeId: string | null;
  hasOfficialCheer: boolean | null;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonical({
          lyrics: row.lyrics,
          youtubeId: row.youtubeId,
          hasOfficialCheer: row.hasOfficialCheer,
        }),
      ),
    )
    .digest("hex");
}
function hasContent(value: unknown) {
  const parsed = lyricsDataSchema.safeParse(value);
  return (
    parsed.success && parsed.data.some((line) => line.segments.some(({ text }) => text.trim()))
  );
}
function requireAdmin(ctx: RequestContext) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  return ctx.user.id;
}
export async function planLegacyGuideImport(ctx: RequestContext) {
  requireAdmin(ctx);
  const rows = await findLegacyGuideCandidates(getDatabase());
  return {
    version: 1 as const,
    entries: rows
      .filter((row) => row.youtubeId?.trim() && hasContent(row.lyrics))
      .map((row) => ({
        songId: row.id,
        title: row.title,
        slug: row.slug,
        guideId: createEntityId(),
        snapshotId: createEntityId(),
        publicationId: createEntityId(),
        sourceFingerprint: legacyGuideSourceFingerprint(row),
        referenceYoutubeId: row.youtubeId!,
        mode: null,
        legacyWriteTarget: true as const,
        sourceType: null,
        sourceUrl: null,
        guideVideoUrl: null,
        description: null,
      })),
    excludedSongIds: rows
      .filter((row) => !row.youtubeId?.trim() || !hasContent(row.lyrics))
      .map(({ id }) => id),
  };
}
export async function importLegacyGuide(
  ctx: RequestContext,
  entry: LegacyGuideImportEntry,
  apply = false,
) {
  const actorAccountId = requireAdmin(ctx);
  return getDatabase().transaction(async (tx) => {
    const row = await lockSongForGuideWrite(tx, entry.songId);
    const actor = await findAuthorizationFactsByAccountId(tx, actorAccountId);
    if (actor?.role !== "ADMIN" || actor.status !== "ACTIVE") throw new AppError("FORBIDDEN");
    if (
      !row ||
      !hasContent(row.lyrics) ||
      row.youtubeId !== entry.referenceYoutubeId ||
      legacyGuideSourceFingerprint(row) !== entry.sourceFingerprint
    )
      throw new AppError("CHEER_GUIDE_IMPORT_CONFLICT");
    const states = await findGuideImportState(tx, row.id);
    const existing = states.find(({ guide }) => guide.id === entry.guideId);
    if (existing) {
      const snapshot = existing.snapshots[0];
      const publication = existing.publications[0];
      if (
        existing.snapshots.length !== 1 ||
        existing.publications.length !== 1 ||
        existing.guide.mode !== entry.mode ||
        !existing.guide.legacyWriteTarget ||
        existing.guide.lockVersion !== 1 ||
        existing.guide.currentPublicationId !== entry.publicationId ||
        snapshot?.id !== entry.snapshotId ||
        snapshot.versionNo !== 1 ||
        snapshot.createdByAccountId !== null ||
        snapshot.changeSummary !== "기존 가사 응원법 이관" ||
        snapshot.sourceType !== entry.sourceType ||
        snapshot.sourceUrl !== entry.sourceUrl ||
        snapshot.referenceYoutubeId !== entry.referenceYoutubeId ||
        snapshot.guideVideoUrl !== entry.guideVideoUrl ||
        snapshot.description !== entry.description ||
        legacyGuideSourceFingerprint({ ...row, lyrics: snapshot.lyrics }) !==
          entry.sourceFingerprint ||
        publication?.id !== entry.publicationId ||
        publication.publicationNo !== 1 ||
        publication.snapshotId !== entry.snapshotId ||
        publication.action !== "PUBLISH" ||
        publication.reason !== "검토한 기존 응원법 최초 이관" ||
        states.some(({ guide }) => guide.id !== entry.guideId && guide.legacyWriteTarget)
      )
        throw new AppError("CHEER_GUIDE_IMPORT_CONFLICT");
      return { songId: row.id, status: "unchanged" as const };
    }
    if (states.some(({ guide }) => guide.mode === entry.mode || guide.legacyWriteTarget))
      throw new AppError("CHEER_GUIDE_IMPORT_CONFLICT");
    if (!apply) return { songId: row.id, status: "ready" as const };
    await insertImportedGuide(tx, {
      guide: { id: entry.guideId, songId: row.id, mode: entry.mode, legacyWriteTarget: true },
      snapshot: {
        id: entry.snapshotId,
        cheerGuideId: entry.guideId,
        versionNo: 1,
        lyrics: row.lyrics,
        sourceType: entry.sourceType,
        sourceUrl: entry.sourceUrl,
        referenceYoutubeId: entry.referenceYoutubeId,
        guideVideoUrl: entry.guideVideoUrl,
        description: entry.description,
        createdByAccountId: null,
        changeSummary: "기존 가사 응원법 이관",
      },
      publication: {
        id: entry.publicationId,
        cheerGuideId: entry.guideId,
        publicationNo: 1,
        snapshotId: entry.snapshotId,
        action: "PUBLISH",
        actorAccountId,
        reason: "검토한 기존 응원법 최초 이관",
      },
    });
    return { songId: row.id, status: "imported" as const };
  });
}
