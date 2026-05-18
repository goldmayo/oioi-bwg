import { SupabaseClientAuthService } from "@/shared/libs/auth/client-auth.service";

import { createHttpClient } from "./client";

let clientInstance: ReturnType<typeof createHttpClient> | null = null;

export const getKy = async () => {
  if (typeof window === "undefined") {
    // 서버: 매 요청마다 새 서비스와 새 인스턴스 (State Leakage 방지)
    const { SupabaseServerAuthService } = await import("@/shared/libs/auth/server-auth.service");
    return createHttpClient(new SupabaseServerAuthService());
  }

  // 클라이언트: 싱글톤 유지
  if (!clientInstance) {
    clientInstance = createHttpClient(new SupabaseClientAuthService());
  }
  return clientInstance;
};
