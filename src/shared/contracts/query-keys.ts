import { createQueryKeys } from "@lukemorales/query-key-factory";

/** RSC seed와 Client Query가 공유하는 isomorphic Album cache identity다. */
export const albumQueryKeys = createQueryKeys("album", {
  adminList: null,
  detail: (slug: string) => [slug],
});

/** RSC seed와 Client Query가 공유하는 isomorphic Song cache identity다. */
export const songQueryKeys = createQueryKeys("song", {
  adminList: null,
  detail: (slug: string) => [slug],
});

/** RSC seed와 Client Query가 공유하는 isomorphic ability cache identity다. */
export const authAbilityQueryKeys = createQueryKeys("auth", {
  ability: null,
});
