"use client";

import { useCallback, useMemo } from "react";
import type { SaveAdminSongLyrics } from "@oioi-bwg/contracts/song";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import {
  AdminReauthenticationNotice,
  authAbilityQueries,
  createClientAbility,
  useAdminReauthentication,
} from "@/features/auth";
import { LazyLyricsEditor, type SongEditor } from "@/features/manage-lyrics";

import { songMutations, songQueryKeys } from "@/entities/song";

import { ApiError } from "@/shared/api/http-errors";

/** Ability와 Song mutation을 lazy lyric editor에 연결하는 route-private 조합 경계다. */
export function AdminLyricsEditor({ song }: { song: SongEditor }) {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);
  const recovery = useAdminReauthentication();
  const canManage = ability.can("manage", "all") && !recovery.requiresReauthentication;
  const { mutateAsync: saveLyrics } = useMutation({
    ...songMutations.saveLyrics(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: songQueryKeys.adminList() });
    },
    onError: recovery.handleMutationError,
  });

  const saveSongData = useCallback(
    async (id: number, input: SaveAdminSongLyrics) => {
      if (!canManage) {
        throw new ApiError(recovery.requiresReauthentication ? 401 : 403, {
          code: recovery.requiresReauthentication ? "UNAUTHENTICATED" : "FORBIDDEN",
          message: "관리자 로그인과 권한을 확인해주세요.",
        });
      }
      await saveLyrics({ id, input });
    },
    [canManage, recovery.requiresReauthentication, saveLyrics],
  );

  return (
    <>
      <AdminReauthenticationNotice recovery={recovery} />
      {!ability.can("manage", "all") && !recovery.requiresReauthentication && (
        <p role="alert">관리 권한이 없습니다. 작성 중인 내용은 이 화면에 유지됩니다.</p>
      )}
      <fieldset disabled={!canManage} className="h-full min-w-0 border-0 p-0">
        <LazyLyricsEditor key={song.id} song={song} saveSongData={saveSongData} />
      </fieldset>
    </>
  );
}
