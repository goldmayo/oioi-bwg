import { listPublicPolicies } from "@oioi-bwg/server/services/policy-service";
import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";

import { constructMetadata } from "@/shared/lib/metadata";

import { MoreBackButton, MoreHeader } from "../_ui/more-common";

export const dynamic = "force-dynamic";

export const metadata = constructMetadata({
  title: "안내 및 약관",
  path: "/more/policy",
  description: "어이어이바위게의 서비스 이용 안내와 정책을 확인하세요.",
});

export default async function PoliciesPage() {
  const policies = await listPublicPolicies();
  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreBackButton />

      <MoreHeader title="안내 및 약관" subTitle="Policies & Guidelines" className="mt-12" />

      {/* 약관 리스트 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {policies.length === 0 && (
          <p className="text-muted-foreground">아직 등록된 안내가 없어요.</p>
        )}
        {policies.map((policy) => (
          <Link
            key={policy.slug}
            href={`/more/policy/${policy.slug}`}
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
                  {policy.title}
                </span>
                <span className="text-muted-foreground group-hover:text-muted-foreground/80 text-xs font-medium tracking-tight">
                  {policy.description}
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
