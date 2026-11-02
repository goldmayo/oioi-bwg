import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { authAbilityQueries, createClientAbility, useAdminReauthentication } from "@/features/auth";

import { cheerGuideMutations, cheerGuideQueryKeys } from "@/entities/cheer-guide";
import { songQueryKeys } from "@/entities/song";
import { songQueries } from "@/entities/song/api";

import type { GuideCreationValues } from "../_lib/guide-creation-form";

export function useGuideCreationScreen(initialSongId?: string) {
  const client = useQueryClient();
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);
  const songs = useQuery(songQueries.adminList());
  const recovery = useAdminReauthentication();
  const creation = useMutation({
    ...cheerGuideMutations.create(),
    onError: recovery.handleMutationError,
    onSuccess: (_result, input) => {
      void client.invalidateQueries({ queryKey: cheerGuideQueryKeys.adminList() });
      void client.invalidateQueries({ queryKey: songQueryKeys.adminInformation(input.songId) });
    },
  });
  return {
    songs,
    recovery,
    canSubmit:
      ability.can("manage", "all") && !recovery.requiresReauthentication && songs.isSuccess,
    submit: async (input: GuideCreationValues) => {
      await creation.mutateAsync(input);
    },
    saved: () => window.location.replace("/admin/cheer-guides"),
    cancel: () =>
      window.location.assign(
        initialSongId ? `/admin/songs/${initialSongId}?edit=true` : "/admin/cheer-guides",
      ),
  };
}
