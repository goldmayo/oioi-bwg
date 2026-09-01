"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { authAbilityQueryKeys, createClientAbility } from "@/features/auth";
import { authAbilityQueries } from "@/features/auth/api";
import { AlbumManagerClient } from "@/features/manage-album";

import { ApiError } from "@/shared/api/http-errors";

/** Auth와 Album feature를 조합하고 403 발생 시 client ability를 다시 동기화한다. */
export function AdminAlbumManager() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);

  const handleMutationError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 403) {
        void queryClient.invalidateQueries({ queryKey: authAbilityQueryKeys.ability.queryKey });
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
