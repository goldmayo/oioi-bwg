"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { authAbilityQueries, createClientAbility } from "@/features/auth";
import { AlbumManagerClient } from "@/features/manage-album";

import { http } from "@/shared/api/http-client";
import { ApiError, parseClientResponse } from "@/shared/api/http-errors";
import { serializedAbilityResponseSchema } from "@/shared/contracts/authorization";

async function getCurrentAbility(signal?: AbortSignal) {
  const data = await http.get("/api/auth/ability", { signal });
  return parseClientResponse(serializedAbilityResponseSchema, data);
}

/** Auth와 Album feature를 조합하고 403 발생 시 client ability를 다시 동기화한다. */
export function AdminAlbumManager() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    authAbilityQueries.current(({ signal }) => getCurrentAbility(signal)),
  );
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);

  const handleMutationError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 403) {
        void queryClient.invalidateQueries({ queryKey: authAbilityQueries.all() });
      }
    },
    [queryClient],
  );

  return (
    <AlbumManagerClient
      canManage={ability.can("manage", "all")}
      onMutationError={handleMutationError}
    />
  );
}
