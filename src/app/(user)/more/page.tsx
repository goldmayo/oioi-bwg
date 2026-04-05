import { AlertCircle, ChevronRight, History, Megaphone, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { MoreHeader } from "@/shared/components/more/MoreCommon";
import { cn } from "@/shared/utils/utils";

// ----------------------------------------------------------------------
// 1. 메뉴 섹션 정의 (기획서 하위 경로 반영 + 디자인 토큰 적용)
// ----------------------------------------------------------------------
const MAIN_MENU = [
  {
    title: "Notice",
    items: [
      {
        name: "공지사항",
        href: "/more/notice",
        icon: Megaphone,
        color: "text-white",
        desc: "중요 소식 및 서비스 점검 안내",
      },
    ],
  },
  {
    title: "Report",
    items: [
      {
        name: "오류 제보",
        href: "/more/report",
        icon: AlertCircle,
        color: "text-white",
        desc: "불편한 점이나 버그 신고",
      },
    ],
  },
  {
    title: "Service Info",
    items: [
      {
        name: "업데이트 내역",
        href: "/more/updates",
        icon: History,
        color: "text-white",
        desc: "최신 기능 및 개선 사항 확인",
      },
    ],
  },
  {
    title: "Policy",
    items: [
      {
        name: "안내 및 약관",
        href: "/more/policy",
        icon: ShieldCheck,
        color: "text-white",
        desc: "서비스 이용 규정 및 개인정보 정책",
      },
    ],
  },
];

// ----------------------------------------------------------------------
// 2. 서버 컴포넌트 구현
// ----------------------------------------------------------------------
export default function MorePage() {
  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreHeader title="더보기" subTitle="more" />

      {/* 메뉴 섹션 리스트 */}
      <div className="flex flex-col gap-4 md:gap-12">
        {MAIN_MENU.map((section) => (
          <section key={section.title} className="flex max-w-3xl flex-col gap-4">
            <h3 className="text-2xs text-muted-foreground px-2 font-black tracking-widest uppercase">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {section.items.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={false}
                  className="group border-border bg-card hover:bg-accent flex w-full items-center justify-between rounded-2xl border p-5 shadow-sm transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "bg-background flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                        item.color,
                      )}
                    >
                      <item.icon size={24} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-foreground group-hover:text-primary text-base font-bold transition-colors">
                        {item.name}
                      </span>
                      <span className="text-muted-foreground text-xs font-medium tracking-tight">
                        {item.desc}
                      </span>
                    </div>
                  </div>
                  <div className="text-muted-foreground/20 group-hover:text-foreground transition-all group-hover:translate-x-1">
                    <ChevronRight size={20} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
