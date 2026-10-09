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

import { songQueryKeys } from "@/entities/song";

import { uploadAlbumImageAction } from "../_lib/upload-album-image-action";

/** 관리 권한과 재인증 안내를 조합하며 열린 폼의 초안을 보존한다. */
export function AdminAlbumManager() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);

  const recovery = useAdminReauthentication();
  const handleNameChangeOrDelete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: songQueryKeys.adminList() });
  }, [queryClient]);

  return (
    <>
      <AdminReauthenticationNotice recovery={recovery} />
      <AlbumManagerClient
        canManage={ability.can("manage", "all") && !recovery.requiresReauthentication}
        submissionNotice={<AdminReauthenticationNotice recovery={recovery} />}
        onUploadImage={uploadAlbumImageAction}
        onMutationError={recovery.handleMutationError}
        onNameChangeOrDelete={handleNameChangeOrDelete}
      />
    </>
  );
}
