"use client";

import { queryOptions } from "@tanstack/react-query";

import { getAdminAlbums } from "./api";
import { adminAlbumQueryKeys } from "./query-keys";

export const adminAlbumQueries = {
  list: () =>
    queryOptions({
      ...adminAlbumQueryKeys.albums,
      staleTime: 30_000,
      queryFn: ({ signal }) => getAdminAlbums(signal),
    }),
};
