"use server";

import { AuthError } from "next-auth";

import { signIn as authSignIn, signOut as authSignOut } from "@/auth";

/**
 * 관리자 로그인 액션
 */
export async function signIn(formData: FormData) {
  try {
    formData.set("redirectTo", "/admin");
    await authSignIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError && error.type === "CredentialsSignin") {
      return { error: "이메일 또는 비밀번호를 확인해주세요." };
    }

    throw error;
  }
}

/**
 * 로그아웃 액션
 */
export async function signOut() {
  await authSignOut({ redirectTo: "/" });
}
