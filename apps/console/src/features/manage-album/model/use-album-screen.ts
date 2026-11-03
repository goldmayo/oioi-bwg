import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AdminAlbumSummary } from "@/entities/album";
import { albumQueryKeys } from "@/entities/album";
import { albumMutations } from "@/entities/album/api";
import { cheerGuideQueryKeys } from "@/entities/cheer-guide";
import { songQueryKeys } from "@/entities/song";

import { adminPaths } from "@/shared/config/admin-routes";

import type { AlbumFormValues } from "./schemas";

export function useAlbumScreen(
  album: AdminAlbumSummary | undefined,
  onMutationError?: (error: unknown) => void,
) {
  const queryClient = useQueryClient();
  const create = useMutation({ ...albumMutations.create(), onError: onMutationError });
  const update = useMutation({ ...albumMutations.update(), onError: onMutationError });
  return {
    submit: async (values: AlbumFormValues) => {
      const input = { ...values, releaseDate: values.releaseDate || null };
      if (album) {
        const result = await update.mutateAsync({ id: album.id, input });
        if (result.name !== album.name)
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: songQueryKeys.adminList() }),
            queryClient.invalidateQueries({ queryKey: cheerGuideQueryKeys.adminList() }),
          ]);
      } else await create.mutateAsync(input);
      await queryClient.invalidateQueries({ queryKey: albumQueryKeys.adminList() });
    },
    saved: () => window.location.replace(adminPaths.albumList),
  };
}
