import { listPublicPolicies } from "@oioi-bwg/server/services/policy-service";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { constructMetadata } from "@/shared/lib/metadata";

import { PolicyPageFrame } from "./_ui/policy-page-frame";

export const dynamic = "force-dynamic";

export const metadata = constructMetadata({
  title: "안내 및 약관",
  path: "/more/policy",
  description: "어이어이바위게의 서비스 이용 안내와 정책을 확인하세요.",
});

export default async function PoliciesPage() {
  const policies = await listPublicPolicies();
  return (
    <PolicyPageFrame>
      {policies.length === 0 ? (
        <p className="text-muted-foreground py-8 leading-relaxed">아직 등록된 안내가 없어요.</p>
      ) : (
        <ul className="divide-border divide-y">
          {policies.map((policy) => (
            <li key={policy.slug}>
              <Link
                href={`/more/policy/${policy.slug}`}
                prefetch={false}
                className="group focus-visible:outline-ring flex items-start justify-between gap-5 py-7 focus-visible:outline-2 focus-visible:outline-offset-4 md:py-8"
              >
                <div className="min-w-0 space-y-3">
                  <h2 className="text-foreground text-xl leading-snug font-bold break-keep group-hover:underline group-hover:underline-offset-4 md:text-2xl">
                    {policy.title}
                  </h2>
                  <p className="text-muted-foreground max-w-prose text-base leading-relaxed break-keep">
                    {policy.description}
                  </p>
                </div>
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground mt-1 size-5 shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PolicyPageFrame>
  );
}
