"use client";

import { queryOptions } from "@tanstack/react-query";

import { albumQueryKeys } from "@/shared/contracts/album";

import { getAdminAlbums, getAlbumDetail } from "./api";

export const albumQueries = {
  detail: (slug: string) =>
    queryOptions({
      ...albumQueryKeys.detail(slug),
      queryFn: ({ signal }) => getAlbumDetail(slug, signal),
    }),

  adminList: () =>
    queryOptions({
      ...albumQueryKeys.adminList,
      staleTime: 30_000,
      queryFn: ({ signal }) => getAdminAlbums(signal),
    }),
};
