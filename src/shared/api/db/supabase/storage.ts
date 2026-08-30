import { createClient } from "@supabase/supabase-js";

/**
 * 서버에서 Supabase Storage에 접근하는 클라이언트를 생성한다.
 * Auth 세션 쿠키를 읽거나 갱신하지 않는 Storage 전용 경계다.
 */
export function createStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase Storage environment variables are required");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
