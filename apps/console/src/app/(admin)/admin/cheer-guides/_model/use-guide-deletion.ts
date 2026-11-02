import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAdminReauthentication } from "@/features/auth";

import {
  type AdminCheerGuideList,
  type AdminCheerGuideSummary,
  cheerGuideMutations,
  cheerGuideQueryKeys,
} from "@/entities/cheer-guide";
import { songQueryKeys } from "@/entities/song";

import { ApiError } from "@/shared/api/http-errors";

export function useGuideDeletion(canManage: boolean, onDeleted: (ids: string[]) => void) {
  const client = useQueryClient();
  const mutation = useMutation(cheerGuideMutations.delete());
  const recovery = useAdminReauthentication();
  const busy = useRef(false);
  const [targets, setTargets] = useState<AdminCheerGuideSummary[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function requestDelete(guides: AdminCheerGuideSummary[]) {
    if (busy.current || !canManage || !guides.length || guides.some((guide) => !guide.deletable))
      return;
    setTargets([...guides]);
    setError("");
    setMessage("");
  }
  function close() {
    if (busy.current) return;
    setTargets([]);
    setError("");
  }
  async function confirm() {
    if (busy.current || !canManage || recovery.requiresReauthentication || !targets.length) return;
    busy.current = true;
    setPending(true);
    setError("");
    const deleted: AdminCheerGuideSummary[] = [];
    try {
      for (const guide of targets) {
        try {
          await mutation.mutateAsync(guide.id);
          deleted.push(guide);
        } catch (cause) {
          recovery.handleMutationError(cause);
          setError(
            cause instanceof ApiError
              ? cause.message
              : "삭제 결과를 확인하지 못했습니다. 목록을 확인한 뒤 다시 시도해주세요.",
          );
          break;
        }
      }
      if (deleted.length) {
        const ids = deleted.map(({ id }) => id);
        client.setQueryData(
          cheerGuideQueryKeys.adminList(),
          (current: AdminCheerGuideList | undefined) =>
            current && { ...current, items: current.items.filter(({ id }) => !ids.includes(id)) },
        );
        onDeleted(ids);
        setMessage(`${deleted.length}개 응원법을 삭제했습니다.`);
        // 서버가 확인한 삭제는 후속 조회 실패로 되돌리거나 재시도하지 않는다.
        void Promise.all([
          client.invalidateQueries({ queryKey: songQueryKeys.adminList() }),
          ...deleted.map(({ song }) =>
            client.invalidateQueries({ queryKey: songQueryKeys.adminInformation(song.id) }),
          ),
        ]).catch(() => undefined);
      }
      setTargets(targets.slice(deleted.length));
      void client
        .invalidateQueries({ queryKey: cheerGuideQueryKeys.adminList() })
        .catch(() => undefined);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { targets, pending, message, error, recovery, requestDelete, close, confirm };
}
