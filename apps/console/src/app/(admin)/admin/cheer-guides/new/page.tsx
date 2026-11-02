import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { listAdminSongs } from "@oioi-bwg/server/services/song-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { authAbilityQueryKeys } from "@/features/auth";

import { songQueryKeys } from "@/entities/song";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";

import { GuideCreationScreen } from "./_ui/GuideCreationScreen";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function GuideCreationPage({
  searchParams,
}: {
  searchParams: Promise<{ songId?: string | string[] }>;
}) {
  const context = await getAdminPageContext();
  const { songId } = await searchParams;
  const parsed = songId === undefined ? undefined : entityIdSchema.safeParse(songId);
  if (parsed && !parsed.success) notFound();
  const initialSongId = parsed?.success ? parsed.data : undefined;
  const songs = await listAdminSongs(context).catch(async (error: unknown) =>
    rethrowAdminPageError(error, await getRequestAuthorization()),
  );
  if (initialSongId && !songs.items.some(({ id }) => id === initialSongId)) notFound();
  const client = getQueryClient();
  client.setQueryData(songQueryKeys.adminList(), songs);
  client.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );
  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight">응원법 추가</h1>
          <p className="text-muted-foreground mt-2 text-sm">추가한 응원법은 공개되지 않습니다.</p>
        </header>
        <HydrationBoundary state={dehydrate(client)}>
          <GuideCreationScreen initialSongId={initialSongId} />
        </HydrationBoundary>
      </div>
    </div>
  );
}
