"use client";

import { queryOptions } from "@tanstack/react-query";

import { getAdminSongs, getSongDetail } from "./api";
import { songQueryKeys } from "./query-keys";

export const songQueries = {
  detail: (slug: string) =>
    queryOptions({
      queryKey: songQueryKeys.detail(slug),
      queryFn: ({ signal }) => getSongDetail(slug, signal),
    }),

  adminList: () =>
    queryOptions({
      queryKey: songQueryKeys.adminList(),
      staleTime: 30_000,
      queryFn: ({ signal }) => getAdminSongs(signal),
    }),
};
