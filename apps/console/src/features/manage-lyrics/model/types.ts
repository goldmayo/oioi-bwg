import type { GuideWriteVersion, LyricsData } from "@oioi-bwg/contracts/song";

/** 가사 편집기를 초기화하는 feature 전용 Song projection이다. */
export interface SongEditor {
  id: string;
  title: string;
  albumName?: string;
  youtubeId: string;
  lyrics: LyricsData;
  guideWrite?: GuideWriteVersion;
}

export interface WaveformImportControls {
  videoId: string;
  onError: (error: unknown) => void;
}

/** 메뉴 계층은 Console 루트가, 실제 진입 화면 복귀는 편집 화면이 소유한다. */
export interface EditorReturnTarget {
  href: string;
  label: string;
  description?: string;
}
