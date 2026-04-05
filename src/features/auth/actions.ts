"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/shared/api/db/supabase/server";

/**
 * 관리자 로그인 액션
 */
export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // 관리자 권한 체크 (app_metadata를 사용)
  const userRole = data.user.app_metadata?.role;
  if (userRole !== "admin") {
    await supabase.auth.signOut();
    return { error: "관리자 권한이 없습니다." };
  }

  // 로그인 시 전체 레이아웃 재검증하여 헤더/사이드바 등 최신화
  revalidatePath("/", "layout");
  redirect("/admin");
}

/**
 * 로그아웃 액션
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // 로그아웃 시 전체 레이아웃 재검증
  revalidatePath("/", "layout");
  redirect("/"); // /login 페이지가 따로 없으므로 /admin(로그인 폼 렌더링)으로 보냄
}
