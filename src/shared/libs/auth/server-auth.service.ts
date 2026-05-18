// 서버 전용 모듈 - 클라이언트 번들에 포함되는 것을 방지
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { AuthStrategy } from "@/shared/types/auth";

export class SupabaseServerAuthService implements AuthStrategy {
  async getAccessToken() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Server Component 렌더링 시에는 쿠키를 구울 수 없으므로 무시합니다.
              // (미들웨어에서 토큰 갱신 및 쿠키 설정 처리가 되어야 합니다)
            }
          },
        },
      },
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }

  async refreshToken(): Promise<string | null> {
    // 사용자의 피드백 반영: SSR에서의 Silent Refresh는 안티패턴.
    // 쿠키 조작은 렌더링 전 단계인 Middleware에서 수행되어야 함.
    throw new Error(
      "[ServerAuthError] SSR 환경에서의 명시적인 Silent Refresh(토큰 갱신)는 안티패턴입니다. Middleware에서 세션 갱신 로직을 처리해주세요.",
    );
  }

  onAuthError() {
    // 서버 환경에서는 window.location.href 등으로 리다이렉트 불가
    // Next.js Server Components나 Route Handlers 특성에 맞게 로깅만 수행하거나,
    // 상위로 에러를 던져 ErrorBoundary나 캐치 블록에서 리다이렉트(next/navigation의 redirect)를 하도록 위임합니다.
    console.warn("[ServerAuthError] Authentication failed on the server.");
  }
}
