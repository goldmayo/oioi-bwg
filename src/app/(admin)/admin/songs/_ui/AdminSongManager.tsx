"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { authAbilityQueries, authAbilityQueryKeys, createClientAbility } from "@/features/auth";
import { SongManagerClient } from "@/features/manage-song";

import { ApiError } from "@/shared/api/http-errors";

/** Auth와 Song feature를 조합하고 403 발생 시 client ability를 다시 동기화한다. */
export function AdminSongManager() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);

  const handleMutationError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 403) {
        void queryClient.invalidateQueries({ queryKey: authAbilityQueryKeys.ability() });
      }
    },
    [queryClient],
  );

  return (
    <SongManagerClient
      canManage={ability.can("manage", "all")}
      onMutationError={handleMutationError}
    />
  );
}
