import { listPublicUpdates } from "@oioi-bwg/server/services/publication-service";

import { constructMetadata } from "@/shared/lib/metadata";
import { cn } from "@/shared/lib/utils";

import { MoreBackButton, MoreHeader } from "../_ui/more-common";

export const dynamic = "force-dynamic";

export const metadata = constructMetadata({
  title: "업데이트 내역",
  path: "/more/updates",
  description: "어이어이바위게의 기능 추가와 개선 내역입니다.",
});

export default async function UpdatesPage() {
  const updates = await listPublicUpdates();
  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreBackButton />

      <MoreHeader title="업데이트 내역" subTitle="Development Timeline" className="mt-12" />

      {/* 타임라인 (dot + line 조합) */}
      <div className="flex flex-col pl-4">
        {updates.length === 0 && (
          <p className="text-muted-foreground">아직 등록된 업데이트가 없어요.</p>
        )}
        {updates.map((update, idx) => (
          <div key={update.releaseVersion} className="relative flex gap-10 pb-16 last:pb-0">
            {/* 세로 라인 및 도트 */}
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "ring-background z-10 h-4 w-4 rounded-full ring-8",
                  idx === 0 ? "bg-qwer-e shadow-[0_0_20px_var(--color-qwer-e)]" : "bg-muted",
                )}
              />
              {idx !== updates.length - 1 && (
                <div className="bg-border absolute top-4 h-full w-px" />
              )}
            </div>

            {/* 내용 영역 */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-qwer-bwg text-xs font-black tracking-tighter tabular-nums">
                    {update.publishedOn}
                  </span>
                  <span
                    className={cn(
                      "text-2xs rounded-[4px] px-2 py-0.5 font-black tracking-widest uppercase",
                      idx === 0 ? "bg-qwer-e/20 text-qwer-e" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {update.releaseVersion}
                  </span>
                </div>
                <h2 className="text-foreground text-xl font-black">{update.title}</h2>
              </div>

              <ul className="flex flex-col gap-2">
                {update.content.map((item, i) => (
                  <li
                    key={i}
                    className="text-muted-foreground flex gap-2 text-sm leading-relaxed font-medium"
                  >
                    <span className="bg-border mt-2 h-1 w-1 shrink-0 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
