import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { getAdminCheerGuideEditor } from "@oioi-bwg/server/services/cheer-guide-draft-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { authAbilityQueryKeys } from "@/features/auth";

import { cheerGuideQueryKeys } from "@/entities/cheer-guide";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";

import { AdminPageLocation } from "../../../_model/admin-location";

import { GuideDraftEditor } from "./_ui/GuideDraftEditor";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function GuideEditPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getAdminPageContext();
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const guide = await getAdminCheerGuideEditor(context, parsed.data).catch(
    async (error: unknown) => {
      if (error instanceof AppError && error.code === "CHEER_GUIDE_NOT_FOUND") notFound();
      return rethrowAdminPageError(error, await getRequestAuthorization());
    },
  );
  const client = getQueryClient();
  client.setQueryData(cheerGuideQueryKeys.editor(guide.id), guide);
  client.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <AdminPageLocation
        title={`${guide.song.title} · ${guide.mode === "CONCERT" ? "콘서트" : "페스티벌"} 편집`}
      />
      <GuideDraftEditor key={guide.id} id={guide.id} accountId={context.user!.id} />
    </HydrationBoundary>
  );
}
