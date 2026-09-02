"use client";

import { queryOptions } from "@tanstack/react-query";

import { songQueryKeys } from "@/shared/contracts/song";

import { getAdminSongs, getSongDetail } from "./api";

export const songQueries = {
  detail: (slug: string) =>
    queryOptions({
      ...songQueryKeys.detail(slug),
      queryFn: ({ signal }) => getSongDetail(slug, signal),
    }),

  adminList: () =>
    queryOptions({
      ...songQueryKeys.adminList,
      staleTime: 30_000,
      queryFn: ({ signal }) => getAdminSongs(signal),
    }),
};
