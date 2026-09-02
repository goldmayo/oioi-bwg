/** RSC seed와 Client Query가 공유하는 Album cache identity다. */
export const albumQueryKeys = {
  adminList: { queryKey: ["album", "adminList"] as const },
  detail: (slug: string) => ({ queryKey: ["album", "detail", slug] as const }),
};
