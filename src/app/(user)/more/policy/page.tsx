import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";

import { MoreBackButton, MoreHeader } from "@/shared/components/more/MoreCommon";

// 기획서 기반 약관 목록 (Server Side)
const POLICIES = [
  {
    name: "개인정보 처리방침",
    href: "/more/policy/privacy",
    desc: "여러분의 소중한 개인정보를 어떻게 보호하고 있는지 알려드립니다.",
  },
  {
    name: "이용 약관",
    href: "/more/policy/terms",
    desc: "어이어이 바위게 서비스 이용을 위한 기본적인 규칙입니다.",
  },
  {
    name: "저작권 정책",
    href: "/more/policy/copyright",
    desc: "응원법 및 앨범 자산의 저작권에 관한 안내입니다.",
  },
  {
    name: "이메일 무단 수집 거부",
    href: "/more/policy/email",
    desc: "무분별한 광고성 연락으로부터의 권리를 보호합니다.",
  },
  {
    name: "GA 수집 안내",
    href: "/more/policy/ga",
    desc: "더 나은 서비스 경험을 위한 통계 데이터 수집에 관한 안내입니다.",
  },
];

export default function PoliciesPage() {
  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreBackButton />

      <MoreHeader title="안내 및 약관" subTitle="Policies & Guidelines" className="mt-12" />

      {/* 약관 리스트 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {POLICIES.map((policy) => (
          <Link
            key={policy.name}
            href={policy.href}
            prefetch={false}
            className="group border-border bg-card hover:bg-accent flex w-full items-center justify-between rounded-2xl border p-6 shadow-sm transition-all duration-300"
          >
            <div className="flex items-center gap-5">
              <div className="bg-background flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110">
                <FileText
                  size={22}
                  className="text-muted-foreground/30 group-hover:text-qwer-bwg transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-foreground group-hover:text-foreground text-base font-bold">
                  {policy.name}
                </span>
                <span className="text-muted-foreground group-hover:text-muted-foreground/80 text-xs font-medium tracking-tight">
                  {policy.desc}
                </span>
              </div>
            </div>
            <div className="text-muted-foreground/20 group-hover:text-foreground/60 transition-all group-hover:translate-x-1">
              <ChevronRight size={20} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
