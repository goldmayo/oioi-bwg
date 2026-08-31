import { type QueryFunction, queryOptions } from "@tanstack/react-query";

import type { SerializedAbilityResponse } from "@/shared/contracts/authorization";

const authAbilityRootKey = () => ["auth", "ability"] as const;
type AuthAbilityQueryKey = ReturnType<typeof authAbilityRootKey>;

// RSC는 같은 options의 queryKey만 사용한다. Client consumer가 client-only Ky queryFn을 전달한다.
function unavailableQueryFn(): Promise<never> {
  return Promise.reject(new Error("Auth ability browser query function is not configured"));
}

export const authAbilityQueries = {
  all: authAbilityRootKey,
  current: (
    queryFn: QueryFunction<SerializedAbilityResponse, AuthAbilityQueryKey> = unavailableQueryFn,
  ) =>
    queryOptions({
      queryKey: authAbilityQueries.all(),
      staleTime: 30_000,
      queryFn,
    }),
};
