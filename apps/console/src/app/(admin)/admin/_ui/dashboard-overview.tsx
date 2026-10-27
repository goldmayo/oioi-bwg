import { ArrowRight, Bell, Disc3, Music } from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

export function DashboardOverview({
  albumCount,
  songCount,
  visibleSongCount,
}: {
  albumCount: number;
  songCount: number;
  visibleSongCount: number;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        콘텐츠를 관리하고 작업 결과를 확인합니다.
      </p>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="content-heading">
          <h2 id="content-heading" className="mb-4 text-base font-semibold">
            콘텐츠 관리
          </h2>
          <div className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border">
            {[
              {
                href: "/admin/albums",
                title: "앨범",
                description: "앨범 정보와 공개 상태를 관리합니다.",
                count: albumCount,
                unit: "개",
                icon: Disc3,
              },
              {
                href: "/admin/songs",
                title: "곡",
                description: "곡 정보와 가사를 편집합니다.",
                count: songCount,
                unit: "곡",
                icon: Music,
              },
            ].map(({ href, title, description, count, unit, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="hover:bg-accent/50 focus-visible:ring-ring flex items-center gap-4 p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset sm:p-6"
              >
                <Icon className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{title}</span>
                  <span className="text-muted-foreground mt-1 block text-sm leading-6">
                    {description}
                  </span>
                </span>
                <span className="shrink-0 text-base font-semibold tabular-nums">
                  {count}
                  <span className="text-muted-foreground ml-1 text-sm font-normal">{unit}</span>
                </span>
                <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            현재 {visibleSongCount}곡이 표시 상태입니다.
          </p>
        </section>
        <section
          aria-labelledby="jobs-heading"
          className="border-border border-t pt-6 lg:border-t-0 lg:pt-0"
        >
          <h2 id="jobs-heading" className="mb-4 flex items-center gap-2 text-base font-semibold">
            <Bell size={18} aria-hidden="true" />
            작업 알림
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm leading-7">
            오래 걸리는 작업의 완료·실패 결과는 알림 내역에 남습니다. 놓친 알림도 다시 확인할 수
            있습니다.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/admin/notifications">
              알림 내역 보기
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </div>
    </section>
  );
}
