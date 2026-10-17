"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import {
  AdminReauthenticationNotice,
  authAbilityQueries,
  createClientAbility,
  useAdminReauthentication,
} from "@/features/auth";
import { SongManagerClient } from "@/features/manage-song";

/** 관리 권한과 재인증 안내를 조합하며 열린 폼의 초안을 보존한다. */
export function AdminSongManager() {
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);

  const recovery = useAdminReauthentication();
  return (
    <>
      <AdminReauthenticationNotice recovery={recovery} />
      <SongManagerClient
        canManage={ability.can("manage", "all") && !recovery.requiresReauthentication}
        submissionNotice={<AdminReauthenticationNotice recovery={recovery} />}
        onMutationError={recovery.handleMutationError}
      />
    </>
  );
}
