"use client";

import { useState } from "react";
import { Check, ChevronRight, ListMusic, Play, Search, SlidersHorizontal, X } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

import { albums, type PreviewSong, songs } from "../_model/preview-data";

import { AlbumArtwork, PreviewBrand, SourceBadge } from "./preview-parts";

export function SongCatalog({ theme }: { theme: string }) {
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [album, setAlbum] = useQueryState("album", parseAsString.withDefault("all"));
  const [mode, setMode] = useQueryState("mode", parseAsString.withDefault("전체"));
  const [source, setSource] = useQueryState("source", parseAsString.withDefault("전체"));
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState({ album: "all", source: "전체" });
  const [selectedSong, setSelectedSong] = useState<PreviewSong | null>(null);
  const filtered = songs.filter((song) => {
    const albumName = albums.find((item) => item.id === song.album)?.name ?? "";
    return (
      `${song.title} ${albumName}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (album === "all" || song.album === album) &&
      (mode === "전체" || song.mode === mode) &&
      (source === "전체" || song.source === source)
    );
  });
  function clearFilters() {
    void setQuery("");
    void setAlbum("all");
    void setMode("전체");
    void setSource("전체");
  }

  return (
    <div className="oioi-public">
      <header className="oioi-public-header">
        <PreviewBrand />
        <span>
          <ListMusic size={16} /> 응원법
        </span>
      </header>
      <div className="oioi-catalog">
        <header className="oioi-catalog-heading">
          <div>
            <h1>응원법</h1>
            <p>응원은 자유롭게, 조금 알면 더 재밌게.</p>
          </div>
          <span className="oioi-catalog-count">
            {songs.length}
            <small>곡의 예시</small>
          </span>
        </header>
        <label className="oioi-search oioi-catalog-search">
          <Search size={20} aria-hidden="true" />
          <input
            aria-label="곡명 또는 앨범명 검색"
            placeholder="어떤 곡을 함께 부를까요?"
            value={query}
            onChange={(event) => void setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="검색어 지우기" onClick={() => void setQuery("")}>
              <X size={17} />
            </button>
          )}
        </label>
        <section className="oioi-album-picker" aria-label="앨범으로 찾기">
          <div className="oioi-section-heading">
            <h2>앨범으로 찾기</h2>
            <button onClick={() => void setAlbum("all")} aria-pressed={album === "all"}>
              {album === "all" && <Check size={14} />} 전체 앨범
            </button>
          </div>
          <div className="oioi-album-grid">
            {albums.map((item) => (
              <button
                key={item.id}
                aria-pressed={album === item.id}
                onClick={() => void setAlbum(album === item.id ? "all" : item.id)}
              >
                <span className="oioi-album-image">
                  <AlbumArtwork album={item.id} size={112} />
                  {album === item.id && (
                    <span>
                      <Check size={16} />
                    </span>
                  )}
                </span>
                <strong>{item.name}</strong>
                <small>{item.kind}</small>
              </button>
            ))}
          </div>
        </section>
        <div className="oioi-catalog-tools">
          <div className="oioi-segment" role="group" aria-label="공연 종류">
            {["전체", "콘서트", "페스티벌"].map((value) => (
              <button key={value} aria-pressed={mode === value} onClick={() => void setMode(value)}>
                {mode === value && <Check size={14} />}
                {value}
              </button>
            ))}
          </div>
          <label className="oioi-source-filter">
            출처
            <select
              aria-label="응원법 출처"
              value={source}
              onChange={(event) => void setSource(event.target.value)}
            >
              <option>전체</option>
              <option>공식</option>
              <option>팬덤</option>
            </select>
          </label>
          <Dialog
            open={filterOpen}
            onOpenChange={(open) => {
              if (open) setFilterDraft({ album, source });
              setFilterOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="secondary" className="oioi-button oioi-mobile-filter">
                <SlidersHorizontal /> 필터
              </Button>
            </DialogTrigger>
            <DialogContent
              className="oioi-preview oioi-dialog oioi-filter-dialog"
              data-theme={theme}
            >
              <DialogTitle>곡 목록 필터</DialogTitle>
              <DialogDescription>앨범과 출처를 고른 뒤 적용해 주세요.</DialogDescription>
              <label className="oioi-field">
                앨범
                <select
                  aria-label="필터 앨범"
                  value={filterDraft.album}
                  onChange={(event) =>
                    setFilterDraft({ ...filterDraft, album: event.target.value })
                  }
                >
                  <option value="all">전체 앨범</option>
                  {albums.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="oioi-field">
                출처
                <select
                  aria-label="필터 출처"
                  value={filterDraft.source}
                  onChange={(event) =>
                    setFilterDraft({ ...filterDraft, source: event.target.value })
                  }
                >
                  <option>전체</option>
                  <option>공식</option>
                  <option>팬덤</option>
                </select>
              </label>
              <Button
                className="oioi-button oioi-primary"
                onClick={() => {
                  void setAlbum(filterDraft.album);
                  void setSource(filterDraft.source);
                  setFilterOpen(false);
                }}
              >
                필터 적용
              </Button>
            </DialogContent>
          </Dialog>
        </div>
        <div className="oioi-result-count" role="status">
          <span>
            {filtered.length}곡 {query && <span>· “{query}” 검색 결과</span>}
          </span>
          {(query || album !== "all" || mode !== "전체" || source !== "전체") && (
            <button onClick={clearFilters}>
              조건 초기화 <X size={12} />
            </button>
          )}
        </div>
        <div className="oioi-catalog-table">
          <div className="oioi-catalog-table-head">
            <span>곡 / 앨범</span>
            <span>공연 종류</span>
            <span>출처</span>
            <span>길이</span>
            <span className="sr-only">응원법 열기</span>
          </div>
          {filtered.map((song) => (
            <button
              className="oioi-catalog-row"
              key={song.id}
              onClick={() => setSelectedSong(song)}
            >
              <span className="oioi-song-cell">
                <AlbumArtwork album={song.album} size={44} />
                <span>
                  <strong>{song.title}</strong>
                  <small>{albums.find((item) => item.id === song.album)?.name}</small>
                </span>
              </span>
              <span className="oioi-song-mode">{song.mode}</span>
              <SourceBadge source={song.source} />
              <time>{song.duration}</time>
              <span className="oioi-practice-label">
                연습하기 <ChevronRight size={16} />
              </span>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="oioi-empty">
            <Search size={24} />
            <h2>찾는 곡이 없어요.</h2>
            <p>다른 곡명이나 앨범명으로 찾아보세요.</p>
            <Button variant="secondary" className="oioi-button" onClick={clearFilters}>
              검색 조건 초기화
            </Button>
          </div>
        )}
        <p className="oioi-public-note">함께 외치는 부분을 참고해, 편한 방식으로 즐겨 주세요.</p>
      </div>
      <footer className="oioi-public-footer">
        <span>어이어이바위게</span>
        <span>팬이 만드는 응원 가이드 · 화면 시안</span>
      </footer>
      <SongPreviewDialog
        selectedSong={selectedSong}
        setSelectedSong={setSelectedSong}
        theme={theme}
      />
    </div>
  );
}

function SongPreviewDialog({
  selectedSong,
  setSelectedSong,
  theme,
}: {
  selectedSong: PreviewSong | null;
  setSelectedSong: (song: PreviewSong | null) => void;
  theme: string;
}) {
  return (
    <Dialog
      open={selectedSong !== null}
      onOpenChange={(open) => {
        if (!open) setSelectedSong(null);
      }}
    >
      <DialogContent className="oioi-preview oioi-dialog" data-theme={theme}>
        <DialogTitle>{selectedSong?.title} · 응원법</DialogTitle>
        <DialogDescription>
          선택한 곡의 정보입니다. 이 화면은 연습 진입 전의 시안입니다.
        </DialogDescription>
        {selectedSong && (
          <>
            <div className="oioi-song-detail">
              <AlbumArtwork album={selectedSong.album} size={100} />
              <div>
                <SourceBadge source={selectedSong.source} />
                <p>
                  {selectedSong.mode} · {selectedSong.duration}
                </p>
                <small>{albums.find((item) => item.id === selectedSong.album)?.name}</small>
              </div>
            </div>
            <p>
              {selectedSong.source === "공식"
                ? "공식 응원법이에요."
                : "팬들 사이에서 자연스럽게 생겨난 응원법이에요."}
            </p>
            <p className="oioi-muted">
              예시 출처·모드입니다. 실제 공개본과 영상은 연결하지 않았어요.
            </p>
            <Button className="oioi-button" onClick={() => setSelectedSong(null)}>
              <Play /> 곡 목록으로 돌아가기
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
