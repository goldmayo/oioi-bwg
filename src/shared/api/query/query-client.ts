import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { captureClientErrorOnce } from "../capture-client-error";
import { ApiError, ClientContractError, ClientTransportError } from "../http-errors";

import type { AppMutationMeta } from "./react-query";

const QUERY_RETRY_LIMIT = 2;

function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof ClientContractError) return false;
  if (error instanceof DOMException && error.name === "AbortError") return false;

  if (error instanceof ClientTransportError) {
    return (error.status === undefined || error.status >= 500) && failureCount < QUERY_RETRY_LIMIT;
  }

  if (error instanceof ApiError) {
    return error.status >= 500 && failureCount < QUERY_RETRY_LIMIT;
  }

  return failureCount < QUERY_RETRY_LIMIT;
}

export function getGlobalMutationErrorMessage(
  error: unknown,
  meta?: AppMutationMeta,
): string | undefined {
  if (meta?.skipGlobalError) return undefined;
  if (meta?.errorMessage) return meta.errorMessage;

  if (error instanceof ApiError) return error.message;
  if (error instanceof ClientTransportError) return error.message;
  if (error instanceof ClientContractError) return "서버 응답을 확인하는 중 오류가 발생했습니다.";

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

interface CreateQueryClientOptions {
  onMutationError?: (message: string) => void;
}

function captureClientBoundaryError(error: unknown, source: string) {
  if (
    error instanceof ClientContractError ||
    (error instanceof ClientTransportError && error.code === "HTTP_ERROR")
  ) {
    captureClientErrorOnce(error, { source });
  }
}

export function createQueryClient(options: CreateQueryClientOptions = {}) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => captureClientBoundaryError(error, "query-cache"),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        captureClientBoundaryError(error, "mutation-cache");
        const message = getGlobalMutationErrorMessage(error, mutation.options.meta);
        if (message) options.onMutationError?.(message);
      },
    }),
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
