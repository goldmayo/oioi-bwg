"use client";

import { signIn } from "next-auth/react";

/** Web은 일반 Credentials HTTP 흐름만 사용한다. 관리 Server Action은 제공하지 않는다. */
export function signInWithPassword(email: string, password: string) {
  return signIn("credentials", { email, password, redirect: false, redirectTo: "/" });
}
