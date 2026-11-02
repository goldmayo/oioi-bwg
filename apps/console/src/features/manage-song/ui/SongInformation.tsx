import { Eye, EyeOff, Pencil } from "lucide-react";

import type { AdminSongInformation } from "@/entities/song";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

export function SongInformation({
  song,
  canManage,
}: {
  song: AdminSongInformation;
  canManage: boolean;
}) {
  const Visibility = song.isVisible ? Eye : EyeOff;
  return (
    <>
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">곡 정보</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            곡의 기본 정보와 응원법을 확인합니다.
          </p>
        </div>
        {canManage && (
          <Button variant="brand" asChild>
            <a href={`/admin/songs/${song.id}?edit=true`}>
              <Pencil />
              편집
            </a>
          </Button>
        )}
      </header>
      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2" aria-labelledby="song-basics">
          <h2 id="song-basics" className="border-b pb-3 font-medium">
            기본 정보
          </h2>
          <dl className="grid gap-6 text-sm sm:grid-cols-2">
            {[
              ["곡 제목", song.title],
              ["앨범", song.album.name],
              ["YouTube ID", song.youtubeId],
              ["Slug", song.slug ?? "미지정"],
              ["정렬 순서", song.order],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground mb-2">{label}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </dl>
          <h2 className="border-b pt-4 pb-3 font-medium">가사</h2>
          <p className="text-sm">{song.hasLyrics ? "등록됨" : "미등록"}</p>
          <p className="text-muted-foreground text-sm">
            가사 파일 교체는 곡 정보 수정에서 할 수 있습니다.
          </p>
        </section>
        <aside className="space-y-8">
          <section className="space-y-4" aria-labelledby="song-display">
            <h2 id="song-display" className="border-b pb-3 font-medium">
              표시 설정
            </h2>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">곡 화면 표시</dt>
                <dd className="flex items-center gap-2">
                  <Visibility className="size-4" />
                  {song.isVisible ? "표시" : "숨김"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">타이틀곡</dt>
                <dd>{song.isTitle ? "예" : "아니요"}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground text-xs leading-5">
              곡의 표시 설정입니다. 앨범 설정과 응원법 공개 상태에 따라 사용자 노출이 달라집니다.
            </p>
          </section>
          <SongGuideSummary song={song} canManage={canManage} />
        </aside>
      </div>
    </>
  );
}

export function SongGuideSummary({
  song,
  canManage,
}: {
  song: AdminSongInformation;
  canManage: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="song-guides">
      <h2 id="song-guides" className="border-b pb-3 font-medium">
        응원법
      </h2>
      {(["CONCERT", "FESTIVAL"] as const).map((mode) => {
        const guide = song.cheerGuides.find((item) => item.mode === mode);
        const publication = guide?.currentPublication;
        return (
          <div key={mode} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {mode === "CONCERT" ? "콘서트" : "페스티벌"}
            </span>
            <div className="flex items-center gap-2">
              {publication ? (
                <>
                  <Badge variant={publication.sourceType === "OFFICIAL" ? "q" : "bwg"}>
                    {publication.sourceType === "OFFICIAL" ? "official" : "fan-made"}
                  </Badge>
                  {publication.action === "UNPUBLISH" && (
                    <EyeOff aria-label="응원법 비공개" className="text-muted-foreground size-4" />
                  )}
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
      {canManage && song.slug && (
        <Button variant="outline" asChild className="w-full">
          <a href={`/admin/edit/${song.slug}`}>응원법 편집</a>
        </Button>
      )}
      {!song.slug && (
        <p className="text-muted-foreground text-xs">
          응원법 편집기에 들어가려면 Slug를 지정해주세요.
        </p>
      )}
    </section>
  );
}
