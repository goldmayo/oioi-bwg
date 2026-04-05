import { MoreBackButton, MoreHeader } from "@/shared/components/more/MoreCommon";
import { cn } from "@/shared/utils/utils";

// 기획서 기반 데이터 (Server Side)
const UPDATES = [
  {
    version: "v2.0.1",
    date: "2024-04-05",
    isCurrent: true,
    title: "홈 리스크 뷰 리뉴얼",
    content: [
      "모바일 최적화 하이브리드 리스트 레이아웃 도입",
      "아코디언 기반 탐색 뎁스 축소 (4단계 -> 2단계)",
      "디자인 시스템 2xs(10px) 토큰 정의 및 브랜딩 강화",
    ],
  },
  {
    version: "v1.5.0",
    date: "2024-03-20",
    isCurrent: false,
    title: "공유 및 인앱 우회 기능",
    content: [
      "Web Share API 기반 OS 네이티브 공유 다이얼로그 연동",
      "카카오톡/인스타그램 인앱 브라우저 탈출 가드 적용",
      "앨범 및 곡 상세 메타데이터 최적화",
    ],
  },
  {
    version: "v1.0.0",
    date: "2024-03-01",
    isCurrent: false,
    title: "어이어이 바위게 런칭",
    content: [
      "바위게들의 응원법 연습을 위한 MVP 서비스 오픈",
      "디스코그래피 기반 응원법 검색 및 열람 기능",
    ],
  },
];

export default function UpdatesPage() {
  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreBackButton />

      <MoreHeader title="업데이트 내역" subTitle="Development Timeline" className="mt-12" />

      {/* 타임라인 (dot + line 조합) */}
      <div className="flex flex-col pl-4">
        {UPDATES.map((update, idx) => (
          <div key={update.version} className="relative flex gap-10 pb-16 last:pb-0">
            {/* 세로 라인 및 도트 */}
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "ring-background z-10 h-4 w-4 rounded-full ring-8",
                  update.isCurrent ? "bg-qwer-e shadow-[0_0_20px_var(--color-qwer-e)]" : "bg-muted",
                )}
              />
              {idx !== UPDATES.length - 1 && (
                <div className="bg-border absolute top-4 h-full w-px" />
              )}
            </div>

            {/* 내용 영역 */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-qwer-bwg text-xs font-black tracking-tighter tabular-nums">
                    {update.date}
                  </span>
                  <span
                    className={cn(
                      "text-2xs rounded-[4px] px-2 py-0.5 font-black tracking-widest uppercase",
                      update.isCurrent
                        ? "bg-qwer-e/20 text-qwer-e"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {update.version}
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
