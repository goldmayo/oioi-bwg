"use client";

import { queryOptions } from "@tanstack/react-query";

import { getAlbumDetail } from "./api";
import { albumQueryKeys } from "./query-keys";

export const albumQueries = {
  detail: (slug: string) =>
    queryOptions({
      queryKey: albumQueryKeys.detail(slug),
      queryFn: ({ signal }) => getAlbumDetail(slug, signal),
    }),
};
