import { QueryClient } from "@tanstack/react-query";

import { ApiError, ClientContractError } from "../http-errors";

const QUERY_RETRY_LIMIT = 2;

function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof ClientContractError) return false;
  if (error instanceof DOMException && error.name === "AbortError") return false;

  if (error instanceof ApiError) {
    return error.status >= 500 && failureCount < QUERY_RETRY_LIMIT;
  }

  return failureCount < QUERY_RETRY_LIMIT;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: shouldRetryQuery,
      },
    },
  });
}
