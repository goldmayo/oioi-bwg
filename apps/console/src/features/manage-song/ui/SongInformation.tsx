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
    <div className="grid min-w-0 flex-1 md:grid-cols-[minmax(0,1fr)_minmax(15rem,27%)]">
      <div className="min-w-0 space-y-8 px-4 py-6 md:px-8 md:py-8 lg:px-12">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{song.title}</h1>
            <p className="text-muted-foreground mt-2 text-sm">{song.album.name}</p>
          </div>
          {canManage && (
            <Button variant="ghost" size="sm" asChild>
              <a href={adminLinks.songEdit(song.id)}>
                <Pencil />
                편집
              </a>
            </Button>
          )}
        </header>
        <SongGuideSummary song={song} canManage={canManage} />
        <section className="border-border space-y-2 border-t pt-4" aria-labelledby="song-lyrics">
          <h2 id="song-lyrics" className="text-sm font-semibold">
            가사
          </h2>
          <p className="text-sm">{song.hasLyrics ? "등록됨" : "미등록"}</p>
          <p className="text-muted-foreground text-sm">
            가사 파일 교체는 곡 정보 수정에서 할 수 있습니다.
          </p>
        </section>
      </div>
      <aside
        className="border-border bg-card px-4 py-6 md:border-l md:px-5 md:py-8"
        aria-labelledby="song-properties"
      >
        <h2 id="song-properties" className="mb-3 text-sm font-semibold">
          속성
        </h2>
        <dl className="space-y-3 text-sm">
          <div className="grid grid-cols-[minmax(4.5rem,42%)_1fr] items-center gap-2">
            <dt className="text-muted-foreground">사용자 노출</dt>
            <dd className="flex items-center gap-1.5">
              <VisibilityIcon visible={song.isVisible} />
              {song.isVisible ? "표시" : "숨김"}
            </dd>
          </div>
          <div className="grid grid-cols-[minmax(4.5rem,42%)_1fr] items-center gap-2">
            <dt className="text-muted-foreground">타이틀곡</dt>
            <dd>{song.isTitle ? "예" : "아니요"}</dd>
          </div>
        </dl>
        <dl className="border-border mt-4 space-y-3 border-t pt-4 text-sm">
          {[
            ["앨범", song.album.name],
            ["YouTube ID", song.youtubeId],
            ["Slug", song.slug ?? "미지정"],
            ["정렬 순서", song.order],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(4.5rem,42%)_1fr] gap-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="wrap-anywhere">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
          앨범 설정과 응원법 공개 상태에 따라 사용자 노출이 달라집니다.
        </p>
      </aside>
    </div>
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
    <section className="border-border space-y-3 border-t pt-4" aria-labelledby="song-guides">
      <h2 id="song-guides" className="text-sm font-semibold">
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
        <Button variant="outline" size="sm" asChild className="w-full md:w-fit">
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
