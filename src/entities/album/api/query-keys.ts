import { createQueryKeys } from "@lukemorales/query-key-factory";

/** Album RSC seed와 Client Query가 공유하는 cache identity다. */
export const albumQueryKeys = createQueryKeys("album", {
  adminList: null,
  detail: (slug: string) => [slug],
});
