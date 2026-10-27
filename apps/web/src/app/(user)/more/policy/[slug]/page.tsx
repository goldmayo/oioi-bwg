import { cache } from "react";
import { getPublicPolicy } from "@oioi-bwg/server/services/policy-service";
import { Circle } from "lucide-react";
import { notFound } from "next/navigation";

import { constructMetadata } from "@/shared/lib/metadata";

import { MoreDocumentFrame } from "../../_ui/more-document-frame";

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
    <MoreDocumentFrame title="안내 및 약관" href="/more/policy">
      <article aria-labelledby="policy-title">
        <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-3 text-sm md:text-base">
          <span className="text-foreground dark:text-qwer-w inline-flex items-center gap-2 font-semibold">
            <Circle aria-hidden="true" className="size-2.5 fill-current" />
            시행일
          </span>
          <span aria-hidden="true" className="text-border">
            |
          </span>
          <time dateTime={detail.effectiveOn} className="tabular-nums">
            {detail.effectiveOn.replaceAll("-", ".")}
          </time>
        </div>
        <h2
          id="policy-title"
          className="text-foreground mb-8 text-2xl leading-snug font-bold text-balance break-keep md:mb-10 md:text-3xl"
        >
          {detail.title}
        </h2>
        <div className="max-w-prose space-y-7 text-base leading-loose break-keep md:space-y-8 md:text-lg">
          {detail.content.map((text, idx) => (
            <p key={idx} className="text-foreground/90 whitespace-pre-line">
              {text}
            </p>
          ))}
        </div>
        {detail.changeNotice && (
          <p className="border-border text-muted-foreground mt-12 border-t pt-7 text-sm leading-relaxed md:mt-16">
            {detail.changeNotice}
          </p>
        )}
      </article>
    </MoreDocumentFrame>
  );
}
