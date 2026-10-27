import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminPageContext } from "@/server/auth/admin-page-context";

import { WaveformJobStatus } from "./_ui/job-status";
export default async function WaveformJobPage({ params }: { params: Promise<{ id: string }> }) {
  await getAdminPageContext();
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  return (
    <section className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/notifications"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex min-h-11 items-center gap-2 text-sm"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        알림 내역
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">파형 생성 결과</h1>
      <p className="text-muted-foreground mt-2 mb-8 text-sm leading-6">
        작업 상태를 확인하고 곡 편집을 이어갑니다.
      </p>
      <WaveformJobStatus id={parsed.data} />
    </section>
  );
}
