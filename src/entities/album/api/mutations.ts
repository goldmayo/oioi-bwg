import { mutationOptions } from "@tanstack/react-query";

import type { SaveAdminAlbum } from "@/shared/contracts/album";

import { createAdminAlbum, deleteAdminAlbum, updateAdminAlbum } from "./api";

export const albumMutationKeys = {
  all: () => ["album-mutation"] as const,
  create: () => [...albumMutationKeys.all(), "create"] as const,
  update: () => [...albumMutationKeys.all(), "update"] as const,
  delete: () => [...albumMutationKeys.all(), "delete"] as const,
};

export const albumMutations = {
  create: () =>
    mutationOptions({
      mutationKey: albumMutationKeys.create(),
      mutationFn: createAdminAlbum,
    }),
  update: () =>
    mutationOptions({
      mutationKey: albumMutationKeys.update(),
      mutationFn: ({ id, input }: { id: number; input: SaveAdminAlbum }) =>
        updateAdminAlbum(id, input),
    }),
  delete: () =>
    mutationOptions({
      mutationKey: albumMutationKeys.delete(),
      mutationFn: deleteAdminAlbum,
    }),
};
