import { Pencil } from "lucide-react";

import type { AdminSongInformation } from "@/entities/song";

import { adminLinks } from "@/shared/config/admin-routes";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { VisibilityIcon } from "@/shared/ui/visibility-icon";

export function SongInformation({
  song,
  canManage,
}: {
  song: AdminSongInformation;
  canManage: boolean;
}) {
  return (
    <>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">곡 정보</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            곡의 기본 정보와 응원법을 확인합니다.
          </p>
        </div>
        {canManage && (
          <Button variant="brand" asChild>
            <a href={adminLinks.songEdit(song.id)}>
              <Pencil />
              편집
            </a>
          </Button>
        )}
      </header>
      <div className="space-y-8">
        <section className="space-y-5" aria-labelledby="song-basics">
          <h2 id="song-basics" className="text-lg font-semibold">
            기본 정보
          </h2>
          <dl className="space-y-5 text-sm">
            {[
              ["곡 제목", song.title],
              ["앨범", song.album.name],
              ["YouTube ID", song.youtubeId],
              ["Slug", song.slug ?? "미지정"],
              ["정렬 순서", song.order],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground mb-2">{label}</dt>
                <dd className="wrap-anywhere">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="space-y-5" aria-labelledby="song-display">
          <h2 id="song-display" className="text-lg font-semibold">
            표시 설정
          </h2>
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">사용자 노출</dt>
              <dd className="flex items-center gap-2">
                <VisibilityIcon visible={song.isVisible} />
                {song.isVisible ? "표시" : "숨김"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">타이틀곡</dt>
              <dd>{song.isTitle ? "예" : "아니요"}</dd>
            </div>
          </dl>
          <p className="text-muted-foreground text-sm leading-relaxed">
            곡의 표시 설정입니다. 앨범 설정과 응원법 공개 상태에 따라 사용자 노출이 달라집니다.
          </p>
        </section>
        <section className="space-y-3" aria-labelledby="song-lyrics">
          <h2 id="song-lyrics" className="text-lg font-semibold">
            가사
          </h2>
          <p className="text-sm">{song.hasLyrics ? "등록됨" : "미등록"}</p>
          <p className="text-muted-foreground text-sm">
            가사 파일 교체는 곡 정보 수정에서 할 수 있습니다.
          </p>
        </section>
        <SongGuideSummary song={song} canManage={canManage} />
      </div>
    </>
  );
}

export function SongGuideSummary({
  song,
  canManage,
  returnHref,
}: {
  song: AdminSongInformation;
  canManage: boolean;
  returnHref?: string;
}) {
  return (
    <section className="space-y-4" aria-labelledby="song-guides">
      <h2 id="song-guides" className="text-lg font-semibold">
        응원법
      </h2>
      {(["CONCERT", "FESTIVAL"] as const).map((mode) => {
        const guide = song.cheerGuides.find((item) => item.mode === mode);
        const publication = guide?.currentPublication;
        return (
          <div key={mode} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {mode === "CONCERT" ? "콘서트" : "페스티벌"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && guide?.draftEditorAvailable && (
                <Button size="sm" variant="outline" asChild>
                  <a href={adminLinks.guideEdit(guide.id, returnHref ?? adminLinks.song(song.id))}>
                    {mode === "CONCERT" ? "콘서트" : "페스티벌"} 편집
                  </a>
                </Button>
              )}
              {publication ? (
                <>
                  <Badge variant={publication.sourceType === "OFFICIAL" ? "q" : "w"}>
                    {publication.sourceType === "OFFICIAL" ? "공식" : "팬덤"}
                  </Badge>
                  {publication.action === "UNPUBLISH" && <VisibilityIcon visible={false} />}
                </>
              ) : (
                <span className="text-muted-foreground">
                  {guide ? "등록됨 · 공개 이력 없음" : "미등록"}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {canManage && song.cheerGuides.length < 2 && (
        <Button variant="q" asChild className="w-full">
          <a href={adminLinks.guideCreate(song.id)}>응원법 추가</a>
        </Button>
      )}
      {canManage && song.slug && song.cheerGuides.length === 0 && (
        <Button variant="outline" asChild className="w-full">
          <a href={adminLinks.songLyrics(song.slug)}>응원법 편집</a>
        </Button>
      )}
    </section>
  );
}
