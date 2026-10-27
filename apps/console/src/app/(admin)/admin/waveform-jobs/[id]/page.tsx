import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { notFound } from "next/navigation";

import { getAdminPageContext } from "@/server/auth/admin-page-context";

import { WaveformJobStatus } from "./_ui/job-status";
export default async function WaveformJobPage({ params }: { params: Promise<{ id: string }> }) {
  await getAdminPageContext();
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  return (
    <section className="mx-auto max-w-2xl p-6 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold">파형 생성 결과</h1>
      <WaveformJobStatus id={parsed.data} />
    </section>
  );
}
