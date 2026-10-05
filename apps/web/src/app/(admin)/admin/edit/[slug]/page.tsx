import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { authAbilityQueryKeys } from "@/features/auth";

import { getRequestContext } from "@/server/auth/request-context";
import { getAdminSongEditorBySlug } from "@/server/services/song-service";

import { getQueryClient } from "@/shared/api/query/get-query-client";
import { serializedAbilityResponseSchema } from "@/shared/contracts/authorization";

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

  const context = await getRequestContext();
  const song = await getAdminSongEditorBySlug(context, slug);

  if (!song) {
    return notFound();
  }

  const queryClient = getQueryClient();
  queryClient.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="h-screen overflow-hidden">
        <AdminLyricsEditor song={song} />
      </div>
    </HydrationBoundary>
  );
}
