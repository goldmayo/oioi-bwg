import "server-only";
import type { OperatorSongMatch } from "@oioi-bwg/contracts/operator-waveform";
import { requireUser, type RequestContext } from "../auth/request-context";
import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import { findSongsByVideoIds } from "../repositories/song-repository";

/** youtubeId의 중복을 임의의 한 곡으로 축약하거나 새 곡을 생성하지 않는다. */
export async function resolveOperatorSongs(ctx: RequestContext, videoIds: string[]) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  const rows = await findSongsByVideoIds(getDatabase(), videoIds);
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.youtubeId) continue;
    const matches = groups.get(row.youtubeId) ?? [];
    matches.push(row);
    groups.set(row.youtubeId, matches);
  }
  const items: OperatorSongMatch[] = videoIds.map((videoId) => {
    const matches = groups.get(videoId) ?? [];
    if (!matches.length) return { videoId, status: "missing" };
    if (matches.length > 1) return { videoId, status: "ambiguous", matchCount: matches.length };
    const row = matches[0]!;
    return {
      videoId,
      status: "matched",
      songId: row.id,
      title: row.title ?? "",
      editorHref: row.slug ? `/admin/edit/${encodeURIComponent(row.slug)}` : null,
    };
  });
  return { items };
}
