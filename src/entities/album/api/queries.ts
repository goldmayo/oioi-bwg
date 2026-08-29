import { queryOptions } from "@tanstack/react-query";

import { getAlbumDetail } from "./api";

export const albumQueries = {
  all: () => ["album"] as const,

  detail: (slug: string) =>
    queryOptions({
      queryKey: [...albumQueries.all(), "detail", slug] as const,
      queryFn: ({ signal }) => getAlbumDetail(slug, signal),
    }),
};
