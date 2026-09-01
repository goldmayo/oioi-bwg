"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { authAbilityQueryKeys, createClientAbility } from "@/features/auth";
import { authAbilityQueries } from "@/features/auth/api";
import { LazyAdminEditor, type SongEditor } from "@/features/manage-lyrics";

import { songMutations } from "@/entities/song/api";

import { ApiError } from "@/shared/api/http-errors";
import type { SaveAdminSongLyrics } from "@/shared/contracts/song";

/** Ability와 Song mutation을 lazy lyric editor에 연결하는 route-private 조합 경계다. */
export function AdminLyricsEditor({ song }: { song: SongEditor }) {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);
  const { mutateAsync: saveLyrics } = useMutation({
    ...songMutations.saveLyrics(),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) {
        void queryClient.invalidateQueries({ queryKey: authAbilityQueryKeys.ability.queryKey });
      }
    },
  });

  const saveSongData = useCallback(
    async (id: number, input: SaveAdminSongLyrics) => {
      await saveLyrics({ id, input });
    },
    [saveLyrics],
  );

  if (ability.cannot("manage", "all")) return null;
  return <LazyAdminEditor key={song.id} song={song} saveSongData={saveSongData} />;
}
