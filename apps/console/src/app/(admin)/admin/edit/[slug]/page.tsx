import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { getAdminSongEditorBySlug } from "@oioi-bwg/server/services/song-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { authAbilityQueryKeys } from "@/features/auth";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";
import { safeReturnPath } from "@/shared/lib/safe-return-path";

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
  if (
    requestedGuideId !== undefined &&
    (!entityIdSchema.safeParse(requestedGuideId).success ||
      song?.guideWrite?.guideId !== requestedGuideId)
  )
    return notFound();

  if (!song) {
    return notFound();
  }

  const returnHref = safeReturnPath(query?.returnTo, `/admin/songs/${song.id}`, [
    `/admin/songs/${song.id}`,
    "/admin/cheer-guides",
  ]);
  const queryClient = getQueryClient();
  queryClient.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="h-full min-h-0 overflow-hidden">
        <AdminPageLocation title={`${song.title} 가사 편집`} />
        <AdminLyricsEditor
          song={song}
          accountId={context.user!.id}
          returnTo={{
            href: returnHref,
            label: returnHref.startsWith("/admin/cheer-guides")
              ? "응원법 목록으로 돌아가기"
              : "곡 정보로 돌아가기",
          }}
        />
      </div>
    </HydrationBoundary>
  );
}
