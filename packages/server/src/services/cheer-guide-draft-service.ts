import "server-only";
import type {
  AdminCheerGuideEditor,
  SaveAdminCheerGuideDraft,
} from "@oioi-bwg/contracts/cheer-guide";
import { lyricsDataSchema } from "@oioi-bwg/contracts/song";
import { requireUser, type RequestContext } from "../auth/request-context";
import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import {
  claimGuideVersion,
  findCheerGuideIdentity,
  findGuideEditorRecord,
  insertNextGuideSnapshot,
  lockSongForGuideWrite,
  setGuideWorkingSnapshot,
} from "../repositories/cheer-guide-repository";

export async function getAdminCheerGuideEditor(
  ctx: RequestContext,
  id: string,
): Promise<AdminCheerGuideEditor> {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  const row = await findGuideEditorRecord(getDatabase(), id);
  if (!row) throw new AppError("CHEER_GUIDE_NOT_FOUND");
  const lyrics = lyricsDataSchema.safeParse(row.snapshot.lyrics);
  if (!lyrics.success)
    throw new Error("Stored guide lyrics contract violation", { cause: lyrics.error });
  return {
    id: row.id,
    mode: row.mode,
    lockVersion: row.lockVersion,
    song: { ...row.song, title: row.song.title ?? "" },
    lyrics: lyrics.data,
    referenceYoutubeId: row.snapshot.referenceYoutubeId,
  };
}
export async function saveAdminCheerGuideDraft(
  ctx: RequestContext,
  id: string,
  input: SaveAdminCheerGuideDraft,
) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  const actor = ctx.user.id;
  return getDatabase().transaction(async (tx) => {
    const identity = await findCheerGuideIdentity(tx, id);
    if (!identity) throw new AppError("CHEER_GUIDE_NOT_FOUND");
    if (!(await lockSongForGuideWrite(tx, identity.songId))) throw new AppError("SONG_NOT_FOUND");
    const row = await findGuideEditorRecord(tx, id);
    if (!row) throw new AppError("CHEER_GUIDE_NOT_FOUND");
    const claimed = await claimGuideVersion(tx, id, input.expectedLockVersion);
    if (!claimed) throw new AppError("CHEER_GUIDE_CONFLICT");
    const snapshot = await insertNextGuideSnapshot(tx, {
      ...row.snapshot,
      lyrics: input.lyrics,
      cheerGuideId: id,
      createdByAccountId: actor,
      changeSummary: "응원법 비공개 작업본 저장",
    });
    await setGuideWorkingSnapshot(tx, id, snapshot.id);
    return { id, lockVersion: claimed.lockVersion };
  });
}
