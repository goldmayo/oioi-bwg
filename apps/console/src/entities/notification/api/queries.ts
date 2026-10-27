"use client";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { getNotification, getNotifications } from "./api";
export const notificationQueryKeys = {
  all: (accountId: string) => ["notification", accountId] as const,
};
export const notificationQueries = {
  list: (accountId: string) =>
    infiniteQueryOptions({
      queryKey: [...notificationQueryKeys.all(accountId), "list"],
      initialPageParam: undefined as string | undefined,
      queryFn: ({ pageParam, signal }) => getNotifications(pageParam, signal),
      getNextPageParam: (page) => page.nextCursor ?? undefined,
      staleTime: 30_000,
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
    }),
  detail: (accountId: string, id: string) =>
    queryOptions({
      queryKey: [...notificationQueryKeys.all(accountId), id],
      queryFn: ({ signal }) => getNotification(id, signal),
      staleTime: 0,
    }),
};
