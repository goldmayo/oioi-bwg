"use server";

import { signIn as authSignIn, signOut as authSignOut } from "@/auth";

export async function signIn(formData: FormData) {
  return authSignIn(formData);
}

export async function signOut() {
  await authSignOut();
}
