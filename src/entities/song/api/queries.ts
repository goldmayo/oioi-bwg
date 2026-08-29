import { queryOptions } from "@tanstack/react-query";

import { getSongDetail } from "./api";

export const songQueries = {
  all: () => ["song"] as const,

  detail: (slug: string) =>
    queryOptions({
      queryKey: [...songQueries.all(), "detail", slug] as const,
      queryFn: ({ signal }) => getSongDetail(slug, signal),
    }),
};
