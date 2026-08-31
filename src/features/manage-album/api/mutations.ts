import { mutationOptions } from "@tanstack/react-query";

import type { SaveAdminAlbum } from "@/shared/contracts/album";

import { createAdminAlbum, deleteAdminAlbum, updateAdminAlbum } from "./api";

export const adminAlbumMutationKeys = {
  all: () => ["admin-album-mutation"] as const,
  create: () => [...adminAlbumMutationKeys.all(), "create"] as const,
  update: () => [...adminAlbumMutationKeys.all(), "update"] as const,
  delete: () => [...adminAlbumMutationKeys.all(), "delete"] as const,
};

export const adminAlbumMutations = {
  create: () =>
    mutationOptions({
      mutationKey: adminAlbumMutationKeys.create(),
      mutationFn: createAdminAlbum,
    }),
  update: () =>
    mutationOptions({
      mutationKey: adminAlbumMutationKeys.update(),
      mutationFn: ({ id, input }: { id: number; input: SaveAdminAlbum }) =>
        updateAdminAlbum(id, input),
    }),
  delete: () =>
    mutationOptions({
      mutationKey: adminAlbumMutationKeys.delete(),
      mutationFn: deleteAdminAlbum,
    }),
};
