import "server-only";

import type { GuideWriteVersion, LyricsData } from "@oioi-bwg/contracts/song";

import type { DbExecutor } from "../db";
import type { SongRow } from "../db/schema";
import { AppError } from "../errors/app-error";
import {
  claimGuideVersion,
  findGuidePublication,
  insertNextGuidePublication,
  insertNextGuideSnapshot,
  lockLegacyGuide,
  setGuidePublication,
} from "../repositories/cheer-guide-repository";

/** Caller owns the transaction and has already locked Song. */
export async function writeLegacyGuide(
  executor: DbExecutor,
  song: SongRow,
  actorAccountId: string,
  changes: { lyrics?: LyricsData; youtubeId: string; hasOfficialCheer?: boolean },
  expected?: GuideWriteVersion,
): Promise<GuideWriteVersion | undefined> {
  const guide = await lockLegacyGuide(executor, song.id);
  if (!guide) {
    if (expected) throw new AppError("CHEER_GUIDE_CONFLICT");
    return undefined;
  }
  if (
    changes.youtubeId !== song.youtubeId ||
    (changes.hasOfficialCheer !== undefined &&
      changes.hasOfficialCheer !== (song.hasOfficialCheer ?? false))
  ) {
    throw new AppError("CHEER_GUIDE_CHANGE_RESTRICTED");
  }
  if (!changes.lyrics) return { guideId: guide.id, lockVersion: guide.lockVersion };
  if (expected?.guideId !== guide.id || expected.lockVersion !== guide.lockVersion) {
    throw new AppError("CHEER_GUIDE_CONFLICT");
  }
  const current = guide.currentPublicationId
    ? await findGuidePublication(executor, guide.id, guide.currentPublicationId)
    : undefined;
  if (
    !current ||
    current.action !== "PUBLISH" ||
    current.referenceYoutubeId !== changes.youtubeId
  ) {
    throw new AppError("CHEER_GUIDE_CHANGE_RESTRICTED");
  }
  if (!changes.lyrics.some((line) => line.segments.some((segment) => segment.text.trim()))) {
    throw new AppError("CHEER_GUIDE_CONTENT_INVALID");
  }
  const claimed = await claimGuideVersion(executor, guide.id, expected.lockVersion);
  if (!claimed) throw new AppError("CHEER_GUIDE_CONFLICT");
  const { referenceYoutubeId, sourceType, sourceUrl, guideVideoUrl, description } = current;
  const snapshot = await insertNextGuideSnapshot(executor, {
    referenceYoutubeId,
    sourceType,
    sourceUrl,
    guideVideoUrl,
    description,
    cheerGuideId: guide.id,
    lyrics: changes.lyrics,
    createdByAccountId: actorAccountId,
    changeSummary: "기존 편집기에서 가사 저장",
  });
  const publication = await insertNextGuidePublication(executor, {
    cheerGuideId: guide.id,
    snapshotId: snapshot.id,
    action: "PUBLISH",
    actorAccountId,
    reason: "기존 편집기 저장의 공개 반영",
  });
  await setGuidePublication(executor, guide.id, publication.id);
  return { guideId: guide.id, lockVersion: claimed.lockVersion };
}
