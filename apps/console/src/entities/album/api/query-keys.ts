/** RSC seed와 Client Query가 공유하는 Album cache identity다. */
export const albumQueryKeys = {
  all: ["album"] as const,
  lists: () => [...albumQueryKeys.all, "list"] as const,
  adminList: () => [...albumQueryKeys.lists(), "admin"] as const,
  details: () => [...albumQueryKeys.all, "detail"] as const,
  detail: (slug: string) => [...albumQueryKeys.details(), slug] as const,
};
