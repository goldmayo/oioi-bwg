import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import {
  getAdminSongEditorBySlug,
  getAdminSongInformation,
} from "@oioi-bwg/server/services/song-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";

import { authAbilityQueryKeys } from "@/features/auth";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";
import { adminLinks } from "@/shared/config/admin-routes";

import { getEditorReturnTarget } from "../../_lib/editor-return-target";
import { AdminPageLocation } from "../../_model/admin-location";

import { AdminLyricsEditor } from "./_ui/AdminLyricsEditor";

interface AdminEditPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ guideId?: string | string[]; returnTo?: string | string[] }>;
}

/** 관리자 가사 편집 DTO와 Ability를 서버에서 준비한다. */
export default async function AdminLyricsEditPage({ params, searchParams }: AdminEditPageProps) {
  const { slug } = await params;

  if (!slug) {
    return notFound();
  }

  const context = await getAdminPageContext();
  const song = await getAdminSongEditorBySlug(context, slug).catch(async (error: unknown) =>
    rethrowAdminPageError(error, await getRequestAuthorization()),
  );

  const query = await searchParams;
  const requestedGuideId = query?.guideId;
  if (requestedGuideId !== undefined && !entityIdSchema.safeParse(requestedGuideId).success)
    notFound();

  if (!song) {
    return notFound();
  }

  const returnTarget = getEditorReturnTarget(query?.returnTo, song.id, "song");
  const information = await getAdminSongInformation(context, song.id).catch(
    async (error: unknown) => rethrowAdminPageError(error, await getRequestAuthorization()),
  );
  if (requestedGuideId !== undefined) {
    const guide = information.cheerGuides.find((item) => item.id === requestedGuideId);
    if (!guide?.draftEditorAvailable) notFound();
    redirect(adminLinks.guideEdit(guide.id, returnTarget.href));
  }
  // 곡 URL에는 공연 모드가 없다. 임의로 모드를 고르지 않고 곡 정보에서 선택한다.
  if (information.cheerGuides.length) redirect(adminLinks.songGuides(song.id));
  const queryClient = getQueryClient();
  queryClient.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="h-full min-h-0 overflow-hidden">
        <AdminPageLocation title={`${song.title} 가사 편집`} />
        <AdminLyricsEditor song={song} accountId={context.user!.id} returnTo={returnTarget} />
      </div>
    </HydrationBoundary>
  );
}
