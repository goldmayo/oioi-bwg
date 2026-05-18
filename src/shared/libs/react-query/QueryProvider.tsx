"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorNotifier, makeQueryClient } from "./query-client";

let browserQueryClient: ReturnType<typeof makeQueryClient> | undefined = undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // 서버 환경: 매 요청마다 항상 새로운 QueryClient 인스턴스를 생성 (State Leakage 방지)
    const ssrNotifier: ErrorNotifier = (msg) => console.error("[SSR Query Error]", msg);
    return makeQueryClient({
      // 서버 환경에서는 토스트 알림을 브라우저에 띄울 수 없으므로 로깅으로 대체
      notifyErrorToast: ssrNotifier,
    });
  } else {
    // 브라우저 환경: 인스턴스가 없을 때만 한 번 생성하고 이후 재사용 (Singleton)
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient({
        // DI: 순수 로직인 query-client에 UI 라이브러리(Sonner)의 구체적인 구현체를 주입합니다.
        notifyErrorToast: toast.error,
      });
    }
    return browserQueryClient;
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // 컴포넌트 생명주기 동안 QueryClient 인스턴스를 안정적으로 유지하기 위해 useState 활용
  const [queryClient] = useState(() => getQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
