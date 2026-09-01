import { createQueryKeys } from "@lukemorales/query-key-factory";

/** Song RSC seed와 Client Query가 공유하는 cache identity다. */
export const songQueryKeys = createQueryKeys("song", {
  adminList: null,
  detail: (slug: string) => [slug],
});
