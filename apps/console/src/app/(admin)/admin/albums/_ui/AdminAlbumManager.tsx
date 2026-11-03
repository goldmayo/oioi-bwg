"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import {
  AdminReauthenticationNotice,
  authAbilityQueries,
  createClientAbility,
  useAdminReauthentication,
} from "@/features/auth";
import { AlbumManagerClient } from "@/features/manage-album";

import { cheerGuideQueryKeys } from "@/entities/cheer-guide";
import { songQueryKeys } from "@/entities/song";

/** 관리 권한과 재인증 안내를 조합하며 열린 폼의 초안을 보존한다. */
export function AdminAlbumManager() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);

  const recovery = useAdminReauthentication();
  const handleNameChangeOrDelete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: songQueryKeys.adminList() });
    void queryClient.invalidateQueries({ queryKey: cheerGuideQueryKeys.adminList() });
  }, [queryClient]);

  return (
    <>
      <AdminReauthenticationNotice recovery={recovery} />
      <AlbumManagerClient
        canManage={ability.can("manage", "all") && !recovery.requiresReauthentication}
        onMutationError={recovery.handleMutationError}
        onNameChangeOrDelete={handleNameChangeOrDelete}
      />
    </>
  );
}
