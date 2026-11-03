import { Suspense } from "react";
import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { listAdminCheerGuides } from "@oioi-bwg/server/services/cheer-guide-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { authAbilityQueryKeys } from "@/features/auth";

import { cheerGuideQueryKeys } from "@/entities/cheer-guide";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";

import { AdminGuideList } from "./_ui/AdminGuideList";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function AdminCheerGuidesPage() {
  const context = await getAdminPageContext();
  const list = await listAdminCheerGuides(context).catch(async (error: unknown) =>
    rethrowAdminPageError(error, await getRequestAuthorization()),
  );
  const client = getQueryClient();
  client.setQueryData(cheerGuideQueryKeys.adminList(), list);
  client.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );
  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <HydrationBoundary state={dehydrate(client)}>
          <Suspense fallback={<p role="status">응원법을 불러오는 중입니다.</p>}>
            <AdminGuideList />
          </Suspense>
        </HydrationBoundary>
      </div>
    </div>
  );
}
