import "server-only";

import type { AdminCheerGuideList, CreateAdminCheerGuide } from "@oioi-bwg/contracts/cheer-guide";
import { lyricsDataSchema } from "@oioi-bwg/contracts/song";

import { type RequestContext, requireUser } from "../auth/request-context";
import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import { CheerGuideReferenceError } from "../repositories/repository-error";
import {
  findAdminCheerGuides,
  findCheerGuideIdentity,
  removeEmptyCheerGuide,
  lockSongForGuideWrite,
  insertGuideDraft,
  insertNextGuideSnapshot,
  setGuideWorkingSnapshot,
} from "../repositories/cheer-guide-repository";

/** 공개 조치 없이 Guide와 불변 첫 작업본을 함께 저장한다. */
export async function createAdminCheerGuide(ctx: RequestContext, input: CreateAdminCheerGuide) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  const accountId = ctx.user.id;
  return getDatabase().transaction(async (tx) => {
    const song = await lockSongForGuideWrite(tx, input.songId);
    if (!song) throw new AppError("SONG_NOT_FOUND");
    const lyrics = lyricsDataSchema.safeParse(song.lyrics ?? []);
    if (!lyrics.success) throw new AppError("SONG_LYRICS_INVALID");
    if (!song.youtubeId?.trim()) throw new AppError("CHEER_GUIDE_SOURCE_INVALID");
    const guide = await insertGuideDraft(tx, { songId: input.songId, mode: input.mode });
    if (!guide) throw new AppError("CHEER_GUIDE_ALREADY_EXISTS");
    const snapshot = await insertNextGuideSnapshot(tx, {
      cheerGuideId: guide.id,
      lyrics: lyrics.data,
      referenceYoutubeId: song.youtubeId,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      guideVideoUrl: input.guideVideoUrl,
      description: input.description,
      createdByAccountId: accountId,
      changeSummary: "응원법 비공개 작업본 생성",
    });
    await setGuideWorkingSnapshot(tx, guide.id, snapshot.id);
    return guide;
  });
}

export async function listAdminCheerGuides(ctx: RequestContext): Promise<AdminCheerGuideList> {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  const rows = await findAdminCheerGuides(getDatabase());
  return {
    items: rows.map(({ song, currentPublication, legacyWriteTarget, ...guide }) => ({
      id: guide.id,
      mode: guide.mode,
      updatedAt: guide.updatedAt,
      deletable: guide.hasHistory === false,
      draftEditorAvailable: guide.hasHistory === true,
      song: { id: song.id, title: song.title ?? "", slug: song.slug, albumName: song.album.name },
      currentPublication: currentPublication
        ? {
            action: currentPublication.action,
            sourceType: currentPublication.snapshot.sourceType,
          }
        : null,
      // 기존 writer는 지정 Guide의 공개 내용과 동일 기준 영상만 수정할 수 있다.
      editorAvailable:
        legacyWriteTarget &&
        song.slug !== null &&
        currentPublication?.action === "PUBLISH" &&
        currentPublication.snapshot.referenceYoutubeId === song.youtubeId,
    })),
    nextCursor: null,
  };
}

/** 이력 확인과 삭제는 한 조건부 mutation이며 FK는 경합 중 생성된 이력도 보호한다. */
export async function deleteEmptyCheerGuide(ctx: RequestContext, id: string) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  const database = getDatabase();
  try {
    if (await removeEmptyCheerGuide(database, id)) return;
  } catch (error) {
    if (error instanceof CheerGuideReferenceError) throw new AppError("CHEER_GUIDE_HAS_HISTORY");
    throw error;
  }
  if (await findCheerGuideIdentity(database, id)) throw new AppError("CHEER_GUIDE_HAS_HISTORY");
  throw new AppError("CHEER_GUIDE_NOT_FOUND");
}
