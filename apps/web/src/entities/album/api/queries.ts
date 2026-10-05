"use client";

import { queryOptions } from "@tanstack/react-query";

import { getAdminAlbums, getAlbumDetail } from "./api";
import { albumQueryKeys } from "./query-keys";

export const albumQueries = {
  detail: (slug: string) =>
    queryOptions({
      queryKey: albumQueryKeys.detail(slug),
      queryFn: ({ signal }) => getAlbumDetail(slug, signal),
    }),

  adminList: () =>
    queryOptions({
      queryKey: albumQueryKeys.adminList(),
      staleTime: 30_000,
      queryFn: ({ signal }) => getAdminAlbums(signal),
    }),
};
