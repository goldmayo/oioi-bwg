import { mutationOptions } from "@tanstack/react-query";

import type { SaveAdminSongLyrics, UpdateAdminSong } from "@/shared/contracts/song";

import { createAdminSong, deleteAdminSong, saveAdminSongLyrics, updateAdminSong } from "./api";

export const songMutationKeys = {
  all: () => ["song-mutation"] as const,
  create: () => [...songMutationKeys.all(), "create"] as const,
  update: () => [...songMutationKeys.all(), "update"] as const,
  delete: () => [...songMutationKeys.all(), "delete"] as const,
  saveLyrics: () => [...songMutationKeys.all(), "save-lyrics"] as const,
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
  saveLyrics: () =>
    mutationOptions({
      mutationKey: songMutationKeys.saveLyrics(),
      mutationFn: ({ id, input }: { id: number; input: SaveAdminSongLyrics }) =>
        saveAdminSongLyrics(id, input),
    }),
};
