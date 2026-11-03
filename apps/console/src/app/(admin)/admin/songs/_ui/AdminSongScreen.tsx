"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import {
  AdminReauthenticationNotice,
  authAbilityQueries,
  createClientAbility,
  useAdminReauthentication,
} from "@/features/auth";
import { SongScreen } from "@/features/manage-song";

/** 인가·재인증을 app에서 조합해 기능 slice 사이의 의존을 만들지 않는다. */
export function AdminSongScreen({ id, mode }: { id?: string; mode: "view" | "edit" | "create" }) {
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);
  const recovery = useAdminReauthentication();
  return (
    <SongScreen
      id={id}
      mode={mode}
      canManage={ability.can("manage", "all") && !recovery.requiresReauthentication}
      submissionNotice={<AdminReauthenticationNotice recovery={recovery} />}
      onMutationError={recovery.handleMutationError}
    />
  );
}
