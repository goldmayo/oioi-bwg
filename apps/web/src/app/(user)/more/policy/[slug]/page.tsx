import { cache } from "react";
import { getPublicPolicy } from "@oioi-bwg/server/services/policy-service";
import { notFound } from "next/navigation";

import { constructMetadata } from "@/shared/lib/metadata";

import { MoreBackButton, MoreHeader } from "../../_ui/more-common";

export const dynamic = "force-dynamic";

const getPolicy = cache(async (slug: string) => {
  const detail = await getPublicPolicy(slug);
  if (!detail) notFound();
  return detail;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getPolicy(slug);
  return constructMetadata({
    title: detail.title,
    path: `/more/policy/${slug}`,
    description: detail.description,
  });
}

export default async function PolicyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getPolicy(slug);

  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreBackButton href="/more/policy" label="안내 및 약관으로" />

      <MoreHeader title={detail.title} className="mt-12" />

      {/* 약관 상세 섹션 */}
      <section className="border-border bg-card overflow-hidden rounded-3xl border shadow-xl">
        <div className="border-border bg-accent/40 border-b p-6">
          <p className="text-2xs text-muted-foreground text-2xs font-bold tracking-widest uppercase">
            시행일: {detail.effectiveOn}
          </p>
        </div>

        <div className="flex flex-col gap-10 p-8 lg:p-12">
          {detail.content.map((text, idx) => (
            <div key={idx} className="flex gap-6">
              <span className="text-qwer-bwg/20 text-xl font-black italic">
                {(idx + 1).toString().padStart(2, "0")}
              </span>
              <p className="text-muted-foreground text-base leading-relaxed font-medium">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {detail.changeNotice && (
        <footer className="border-border mt-20 border-t pt-12 opacity-30">
          <p className="text-muted-foreground text-xs font-medium">{detail.changeNotice}</p>
        </footer>
      )}
    </div>
  );
}
