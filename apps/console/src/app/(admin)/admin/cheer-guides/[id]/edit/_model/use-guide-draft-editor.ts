import { useCallback, useMemo, useState } from "react";
import type { SaveAdminSongLyrics } from "@oioi-bwg/contracts/song";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { authAbilityQueries, createClientAbility, useAdminReauthentication } from "@/features/auth";

import {
  cheerGuideMutations,
  cheerGuideQueries,
  cheerGuideQueryKeys,
} from "@/entities/cheer-guide";
import { songQueryKeys } from "@/entities/song";

import { ApiError } from "@/shared/api/http-errors";

export function useGuideDraftEditor(id: string) {
  const client = useQueryClient();
  const { data } = useSuspenseQuery(cheerGuideQueries.editor(id));
  // 편집 시작 snapshot을 유지한다. refetch는 입력과 CAS 기준 버전을 바꾸지 않는다.
  const [guide] = useState(data);
  const { data: authorization } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(authorization.rules), [authorization.rules]);
  const recovery = useAdminReauthentication();
  const canManage = ability.can("manage", "all") && !recovery.requiresReauthentication;
  const { mutateAsync } = useMutation({
    ...cheerGuideMutations.saveDraft(guide.id),
    onError: recovery.handleMutationError,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: cheerGuideQueryKeys.editor(guide.id) });
      void client.invalidateQueries({ queryKey: cheerGuideQueryKeys.adminList() });
      void client.invalidateQueries({ queryKey: songQueryKeys.adminInformation(guide.song.id) });
    },
  });
  const saveSongData = useCallback(
    async (songId: string, input: SaveAdminSongLyrics) => {
      if (!canManage)
        throw new ApiError(recovery.requiresReauthentication ? 401 : 403, {
          code: recovery.requiresReauthentication ? "UNAUTHENTICATED" : "FORBIDDEN",
          message: "관리자 로그인과 권한을 확인해주세요.",
        });
      if (
        songId !== guide.song.id ||
        input.guideWrite?.guideId !== guide.id ||
        input.youtubeId !== guide.referenceYoutubeId
      )
        throw new ApiError(409, {
          code: "CHEER_GUIDE_CONFLICT",
          message: "편집 중인 응원법과 기준 영상을 확인해주세요.",
        });
      const saved = await mutateAsync({
        expectedLockVersion: input.guideWrite.lockVersion,
        lyrics: input.lyrics,
      });
      return {
        id: guide.song.id,
        guideWrite: { guideId: saved.id, lockVersion: saved.lockVersion },
      };
    },
    [canManage, recovery.requiresReauthentication, guide, mutateAsync],
  );
  return {
    guide,
    recovery,
    canManage,
    saveSongData,
    song: {
      id: guide.song.id,
      title: `${guide.song.title} · ${guide.mode === "CONCERT" ? "콘서트" : "페스티벌"}`,
      albumName: guide.song.albumName,
      youtubeId: guide.referenceYoutubeId,
      lyrics: guide.lyrics,
      guideWrite: { guideId: guide.id, lockVersion: guide.lockVersion },
    },
  };
}
