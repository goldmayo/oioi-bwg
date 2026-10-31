import { waveformManifestSchema } from "@oioi-bwg/contracts/waveform";

export function createWaveformDownload(
  songs: { title: string; youtubeId: string }[],
  now = new Date(),
) {
  if (!songs.length) throw new Error("파형 작업을 할 곡을 선택해 주세요.");
  const seen = new Set<string>();
  const invalid = songs.filter((song) => {
    const duplicate = seen.has(song.youtubeId);
    seen.add(song.youtubeId);
    return duplicate || !/^[A-Za-z0-9_-]{11}$/.test(song.youtubeId);
  });
  if (invalid.length)
    throw new Error(
      `영상 ID가 없거나 잘못되었거나 중복된 곡을 확인해 주세요: ${invalid.map((song) => song.title).join(", ")}`,
    );
  const manifest = waveformManifestSchema.parse({
    version: 1,
    videoIds: songs.map((song) => song.youtubeId),
  });
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString();
  const date = kst.slice(0, 10).replaceAll("-", "");
  const time = kst.slice(11, 19).replaceAll(":", "");
  return {
    filename: `oioi-operator-waveform_${date}_${time}_${kst.slice(20, 23)}_KST.json`,
    content: JSON.stringify(manifest, null, 2) + "\n",
  };
}
