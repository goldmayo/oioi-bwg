import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서 호출될 경우 setAll이 실패할 수 있습니다.
            // 미들웨어에서 이미 처리되므로 무시해도 안전한 경우가 많습니다.
          }
        },
      },
    }
  );
}

/**
 * 서버 환경(서버 컴포넌트, 서버 액션)에서 호출하여 
 * 현재 사용자 및 관리자(Admin) 여부를 반환하는 SSOT 유틸리티
 */
export async function checkServerAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.app_metadata?.role === "admin";

  return { supabase, user, isAdmin };
}
