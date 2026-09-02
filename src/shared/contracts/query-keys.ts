/** RSC seed와 Client Query가 공유하는 isomorphic Album cache identity다. */
export const albumQueryKeys = {
  adminList: { queryKey: ["album", "adminList"] as const },
  detail: (slug: string) => ({ queryKey: ["album", "detail", slug] as const }),
};

/** RSC seed와 Client Query가 공유하는 isomorphic Song cache identity다. */
export const songQueryKeys = {
  adminList: { queryKey: ["song", "adminList"] as const },
  detail: (slug: string) => ({ queryKey: ["song", "detail", slug] as const }),
};

/** RSC seed와 Client Query가 공유하는 isomorphic ability cache identity다. */
export const authAbilityQueryKeys = {
  ability: { queryKey: ["auth", "ability"] as const },
};
