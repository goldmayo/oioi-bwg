/** RSC seed와 Client Query가 공유하는 Song cache identity다. */
export const songQueryKeys = {
  adminList: { queryKey: ["song", "adminList"] as const },
  detail: (slug: string) => ({ queryKey: ["song", "detail", slug] as const }),
};
