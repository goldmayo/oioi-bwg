"use client";

import { queryOptions } from "@tanstack/react-query";

import { getAdminSongInformation, getAdminSongs, getSongDetail } from "./api";
import { songQueryKeys } from "./query-keys";

export const songQueries = {
  detail: (slug: string) =>
    queryOptions({
      queryKey: songQueryKeys.detail(slug),
      queryFn: ({ signal }) => getSongDetail(slug, signal),
    }),

  adminInformation: (id: string) =>
    queryOptions({
      queryKey: songQueryKeys.adminInformation(id),
      staleTime: 30_000,
      queryFn: ({ signal }) => getAdminSongInformation(id, signal),
    }),
  adminList: () =>
    queryOptions({
      queryKey: songQueryKeys.adminList(),
      staleTime: 30_000,
      queryFn: ({ signal }) => getAdminSongs(signal),
    }),
};
