/** RSC seed와 Client Query가 공유하는 Song cache identity다. */
export const songQueryKeys = {
  all: ["song"] as const,
  lists: () => [...songQueryKeys.all, "list"] as const,
  adminList: () => [...songQueryKeys.lists(), "admin"] as const,
  details: () => [...songQueryKeys.all, "detail"] as const,
  detail: (slug: string) => [...songQueryKeys.details(), slug] as const,
};
