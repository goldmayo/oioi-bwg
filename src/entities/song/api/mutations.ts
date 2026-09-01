import { mutationOptions } from "@tanstack/react-query";

import type { UpdateAdminSong } from "@/shared/contracts/song";

import { createAdminSong, deleteAdminSong, updateAdminSong } from "./api";

export const songMutationKeys = {
  all: () => ["song-mutation"] as const,
  create: () => [...songMutationKeys.all(), "create"] as const,
  update: () => [...songMutationKeys.all(), "update"] as const,
  delete: () => [...songMutationKeys.all(), "delete"] as const,
};

export const songMutations = {
  create: () =>
    mutationOptions({
      mutationKey: songMutationKeys.create(),
      mutationFn: createAdminSong,
    }),
  update: () =>
    mutationOptions({
      mutationKey: songMutationKeys.update(),
      mutationFn: ({ id, input }: { id: number; input: UpdateAdminSong }) =>
        updateAdminSong(id, input),
    }),
  delete: () =>
    mutationOptions({
      mutationKey: songMutationKeys.delete(),
      mutationFn: deleteAdminSong,
    }),
};
