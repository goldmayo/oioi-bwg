import { createBrowserClient } from "@supabase/ssr";

import { AuthStrategy } from "@/shared/types/auth";

export class SupabaseClientAuthService implements AuthStrategy {
  private supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async getAccessToken() {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async refreshToken() {
    // @supabase/ssr 브라우저 클라이언트는 기본적으로 세션을 자동 관리하지만,
    // 명시적인 갱신이 필요할 경우 refreshSession을 호출합니다.
    const { data, error } = await this.supabase.auth.refreshSession();
    if (error || !data.session) {
      throw error ?? new Error("Failed to refresh token");
    }
    return data.session.access_token;
  }

  onAuthError() {
    // 갱신 실패 시 로그인 페이지로 리다이렉트
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }
}
