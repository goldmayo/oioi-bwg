"use client";

import { signOut } from "../api/actions";

export function requestSignOut(): void {
  if (!window.confirm("로그아웃하시겠습니까?")) return;
  void signOut();
}
