import type { GuideWriteVersion, LyricsData } from "@oioi-bwg/contracts/song";

/** 가사 편집기를 초기화하는 feature 전용 Song projection이다. */
export interface SongEditor {
  id: string;
  title: string;
  youtubeId: string;
  lyrics: LyricsData;
  guideWrite?: GuideWriteVersion;
}

export interface WaveformImportControls {
  videoId: string;
  onError: (error: unknown) => void;
}
