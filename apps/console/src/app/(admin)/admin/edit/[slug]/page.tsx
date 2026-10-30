import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { getAdminSongEditorBySlug } from "@oioi-bwg/server/services/song-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { authAbilityQueryKeys } from "@/features/auth";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";
import { getWaveformGenerationConfig } from "@/shared/config/console-runtime";

import { AdminLyricsEditor } from "./_ui/AdminLyricsEditor";

interface AdminEditPageProps {
  params: Promise<{ slug: string }>;
}

/** 관리자 가사 편집 DTO와 Ability를 서버에서 준비한다. */
export default async function AdminLyricsEditPage({ params }: AdminEditPageProps) {
  const { slug } = await params;

  if (!slug) {
    return notFound();
  }

  const context = await getAdminPageContext();
  const song = await getAdminSongEditorBySlug(context, slug).catch(async (error: unknown) =>
    rethrowAdminPageError(error, await getRequestAuthorization()),
  );

  if (!song) {
    return notFound();
  }

  const queryClient = getQueryClient();
  const generation = getWaveformGenerationConfig();
  const generationVideoId =
    generation.enabled && generation.allowedVideoIds.includes(song.youtubeId)
      ? song.youtubeId
      : undefined;
  queryClient.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="h-full min-h-0 overflow-hidden">
        <AdminLyricsEditor
          song={song}
          accountId={context.user!.id}
          generationVideoId={generationVideoId}
        />
      </div>
    </HydrationBoundary>
  );
}
