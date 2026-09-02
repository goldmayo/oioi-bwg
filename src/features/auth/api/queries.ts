"use client";

import { queryOptions } from "@tanstack/react-query";

import { getCurrentAbility } from "./api";
import { authAbilityQueryKeys } from "./query-keys";

export const authAbilityQueries = {
  current: () =>
    queryOptions({
      queryKey: authAbilityQueryKeys.ability(),
      staleTime: 30_000,
      queryFn: ({ signal }) => getCurrentAbility(signal),
    }),
};
