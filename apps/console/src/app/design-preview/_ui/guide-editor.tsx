"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  FileMusic,
  ListMusic,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

import { albums, cueClass, formatTime, previewDuration, songs } from "../_model/preview-data";
import { usePreviewEditor } from "../_model/use-preview-editor";

import { PreviewInspector } from "./preview-inspector";
import { AlbumArtwork, PreviewBrand, SourceBadge } from "./preview-parts";
import { PreviewTimeline } from "./preview-timeline";

export function GuideEditor({ theme }: { theme: string }) {
  const {
    selected,
    setSelected,
    panel,
    setPanel,
    songId,
    query,
    setQuery,
    playing,
    setPlaying,
    position,
    setPosition,
    message,
    inspector,
    form,
    fields,
    append,
    cues,
    cue,
    visibleSongs,
    song,
    album,
    chooseSong,
    chooseCue,
    resetDraft,
    restoreDraft,
    saveDraft,
  } = usePreviewEditor();
  return (
    <div className="oioi-console">
      <PreviewSongNavigation
        songId={songId}
        query={query}
        setQuery={setQuery}
        visibleSongs={visibleSongs}
        chooseSong={chooseSong}
      />
      <section className="oioi-editor">
        <div className="oioi-breadcrumb">
          <span>Console</span>
          <ChevronRight />
          <span>응원법</span>
          <ChevronRight />
          <strong>내용 편집</strong>
          <span className="oioi-draft-label">
            <LockKeyhole size={13} /> 비공개 작업본
          </span>
        </div>
        <header className="oioi-editor-heading">
          <div className="oioi-song-heading">
            <AlbumArtwork album={song.album} size={44} />
            <div>
              <h1>{song.title}</h1>
              <p>
                {album?.name} <span>·</span> {song.mode} <span>·</span>{" "}
                <SourceBadge source={song.source} />
              </p>
            </div>
          </div>
          <div className="oioi-actions">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="oioi-button">
                  <Eye /> 미리보기
                </Button>
              </DialogTrigger>
              <DialogContent className="oioi-preview oioi-dialog" data-theme={theme}>
                <DialogTitle>응원 구간 미리보기</DialogTitle>
                <DialogDescription>
                  편집 중인 예시 구간입니다. 모의 재생에는 음원이 포함되지 않습니다.
                </DialogDescription>
                <div className="oioi-reading-preview">
                  <span>
                    {song.title} · {song.mode}
                  </span>
                  {cues.slice(Math.max(0, selected - 1), selected + 3).map((item, i) => (
                    <p key={`${i}-${item.time}`} className={`oioi-cue-${cueClass[item.kind]}`}>
                      <small>
                        {formatTime(item.time)} · {item.kind}
                      </small>
                      {item.text}
                    </p>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Button className="oioi-button oioi-primary" onClick={() => void saveDraft()}>
              <Save /> 작업본 저장
            </Button>
          </div>
        </header>
        <div className="oioi-editor-status">
          <span role="status">
            {form.formState.isDirty && "저장하지 않은 변경 · "}
            {message}
          </span>
          <span className="oioi-muted">승인 전 공개 불가</span>
        </div>
        <div className="oioi-editor-tabs" role="group" aria-label="편집 방식">
          <button aria-pressed={panel === "timing"} onClick={() => setPanel("timing")}>
            <Clock3 size={15} /> 타이밍 편집
          </button>
          <button aria-pressed={panel === "lyrics"} onClick={() => setPanel("lyrics")}>
            <FileMusic size={15} /> 가사 편집
          </button>
          <span className="oioi-muted">{fields.length}개 구간</span>
        </div>
        <div className="oioi-editor-body">
          <div className="oioi-transport">
            <div className="oioi-play-controls">
              <Button
                variant="ghost"
                className="oioi-button oioi-icon-button"
                aria-label="이전 구간"
                onClick={() => chooseCue(Math.max(0, selected - 1))}
              >
                <SkipBack />
              </Button>
              <Button
                className="oioi-button oioi-play"
                aria-label={playing ? "모의 재생 일시정지" : "모의 재생 시작"}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause /> : <Play />}
              </Button>
              <Button
                variant="ghost"
                className="oioi-button oioi-icon-button"
                aria-label="다음 구간"
                onClick={() => chooseCue(Math.min(cues.length - 1, selected + 1))}
              >
                <SkipForward />
              </Button>
            </div>
            <div className="oioi-time-readout">
              <strong>{formatTime(position)}</strong>
              <span>/ {formatTime(previewDuration)}</span>
            </div>
            <span className="oioi-muted oioi-simulation">모의 재생</span>
            <label className="oioi-scrubber">
              <span className="sr-only">재생 위치</span>
              <input
                type="range"
                min="0"
                max={previewDuration}
                step="0.01"
                value={position}
                onChange={(event) => setPosition(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="oioi-edit-columns">
            <div className="oioi-edit-main">
              {panel === "timing" && (
                <PreviewTimeline
                  cues={cues}
                  selected={selected}
                  position={position}
                  onChooseCue={chooseCue}
                />
              )}
              <section className="oioi-lyrics" aria-labelledby="oioi-lyrics-title">
                <div className="oioi-panel-heading">
                  <h2 id="oioi-lyrics-title">
                    가사와 응원 <span>{fields.length}</span>
                  </h2>
                  <Button
                    variant="ghost"
                    className="oioi-button"
                    disabled={fields.length >= 100}
                    onClick={() => {
                      append({ time: 26, text: "새 응원 구간", kind: "추임새" });
                      setSelected(fields.length);
                    }}
                  >
                    <Plus /> 구간 추가
                  </Button>
                </div>
                <div className="oioi-lyric-table">
                  <div className="oioi-lyric-header">
                    <span>구간</span>
                    <span>시작 시간</span>
                    <span>가사 / 응원 문구</span>
                    <span>유형</span>
                  </div>
                  {fields.map((field, index) => (
                    <button
                      className="oioi-lyric-row"
                      key={field.id}
                      aria-pressed={selected === index}
                      onClick={() => chooseCue(index)}
                    >
                      <span className="oioi-row-number">
                        {selected === index ? (
                          <Check size={14} />
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </span>
                      <time>{formatTime(cues[index].time || 0)}</time>
                      <span className={`oioi-cue-${cueClass[cues[index].kind]}`}>
                        {cues[index].text || "문구를 입력해 주세요"}
                      </span>
                      <span className="oioi-kind-label">{cues[index].kind}</span>
                    </button>
                  ))}
                </div>
                <div className="oioi-table-foot">
                  <span>
                    <Check size={13} /> {selected + 1}번 구간 선택
                  </span>
                  <Button
                    variant="ghost"
                    className="oioi-button"
                    onClick={() =>
                      inspector.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                  >
                    <SlidersHorizontal /> 선택 구간 편집
                  </Button>
                </div>
              </section>
            </div>
            <PreviewInspector
              form={form}
              selected={selected}
              cue={cue}
              inspector={inspector}
              restoreDraft={restoreDraft}
              resetDraft={resetDraft}
            />
          </div>
          <p className="oioi-editor-footnote">
            <LockKeyhole size={13} /> 이 화면의 저장은 공개 상태를 바꾸지 않습니다. 공개는 별도 승인
            절차가 필요합니다.
          </p>
        </div>
      </section>
    </div>
  );
}

function PreviewSongNavigation({
  songId,
  query,
  setQuery,
  visibleSongs,
  chooseSong,
}: Pick<
  ReturnType<typeof usePreviewEditor>,
  "songId" | "query" | "setQuery" | "visibleSongs" | "chooseSong"
>) {
  return (
    <aside className="oioi-sidebar" aria-label="편집할 곡 선택">
      <PreviewBrand consoleLabel />
      <div className="oioi-workspace-name">
        <span>콘텐츠 관리</span>
        <ChevronDown size={14} />
      </div>
      <div className="oioi-sidebar-current">
        <ListMusic size={16} /> 응원법 <span>{songs.length}</span>
      </div>
      <label className="oioi-search oioi-sidebar-search">
        <Search size={15} aria-hidden="true" />
        <input
          aria-label="편집할 곡 검색"
          placeholder="곡 찾기"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="oioi-section-caption">편집할 곡</p>
      <div className="oioi-song-navigation">
        {visibleSongs.map((item) => (
          <button
            key={item.id}
            aria-pressed={songId === item.id}
            onClick={() => chooseSong(item.id)}
          >
            <AlbumArtwork album={item.album} size={30} />
            <span>
              {item.title}
              <small>{albums.find((a) => a.id === item.album)?.name}</small>
            </span>
            {songId === item.id && <Check size={14} aria-hidden="true" />}
          </button>
        ))}
        {visibleSongs.length === 0 && <p className="oioi-muted">찾는 곡이 없습니다.</p>}
      </div>
      <div className="oioi-sidebar-footer">
        <span className="oioi-avatar">관</span>
        <span>
          시안 관리자<small>로컬 미리보기</small>
        </span>
        <LockKeyhole size={15} aria-hidden="true" />
      </div>
    </aside>
  );
}
