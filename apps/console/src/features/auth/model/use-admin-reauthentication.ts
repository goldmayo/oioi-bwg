"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/shared/api/http-errors";

import { authAbilityQueries } from "../api/queries";
import { authAbilityQueryKeys } from "../api/query-keys";
import { createClientAbility } from "../lib/ability";

const initialMessage = "로그인이 필요합니다. 작성 중인 내용은 이 화면에 유지됩니다.";

/** Console 관리 작업의 재인증 UX를 소유하며 서버 인가를 대체하지 않는다. */
export function useAdminReauthentication() {
  const queryClient = useQueryClient();
  const [requiresReauthentication, setRequiresReauthentication] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const handleMutationError = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) return;
      const queryKey = authAbilityQueryKeys.ability();
      if (error.status === 401) {
        setRequiresReauthentication(true);
        void queryClient.cancelQueries({ queryKey }, { revert: false });
        queryClient.setQueryData(queryKey, { rules: [] });
      }
      if (error.status === 401 || error.status === 403) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient],
  );
  const checkAuthentication = useCallback(async () => {
    try {
      const data = await queryClient.fetchQuery({ ...authAbilityQueries.current(), staleTime: 0 });
      if (createClientAbility(data.rules).can("manage", "all")) {
        setRequiresReauthentication(false);
        setMessage(initialMessage);
      } else {
        setMessage("관리자 로그인이 확인되지 않았습니다. 계정 상태와 권한을 확인해주세요.");
      }
    } catch {
      setMessage("로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }, [queryClient]);
  return { requiresReauthentication, handleMutationError, checkAuthentication, message };
}
