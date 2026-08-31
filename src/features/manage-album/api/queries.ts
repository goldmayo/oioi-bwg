import { type QueryFunction, queryOptions } from "@tanstack/react-query";

import type { AlbumSummary } from "@/shared/contracts/album";

const adminAlbumRootKey = () => ["admin", "albums"] as const;
type AdminAlbumListQueryKey = ReturnType<typeof adminAlbumRootKey>;

// RSC는 같은 options의 queryKey만 사용한다. Client consumer가 client-only Ky queryFn을 전달한다.
function unavailableQueryFn(): Promise<never> {
  return Promise.reject(new Error("Admin album browser query function is not configured"));
}

export const adminAlbumQueries = {
  all: adminAlbumRootKey,
  list: (queryFn: QueryFunction<AlbumSummary[], AdminAlbumListQueryKey> = unavailableQueryFn) =>
    queryOptions({
      queryKey: adminAlbumQueries.all(),
      staleTime: 30_000,
      queryFn,
    }),
};
