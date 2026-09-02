"use client";

import { queryOptions } from "@tanstack/react-query";

import { authAbilityQueryKeys } from "@/shared/contracts/authorization";

import { getCurrentAbility } from "./api";

export const authAbilityQueries = {
  current: () =>
    queryOptions({
      ...authAbilityQueryKeys.ability,
      staleTime: 30_000,
      queryFn: ({ signal }) => getCurrentAbility(signal),
    }),
};
