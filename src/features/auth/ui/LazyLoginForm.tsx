"use client";

import { lazy, Suspense } from "react";

const LoginForm = lazy(() => import("./LoginForm"));

export function LazyLoginForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-100 w-full max-w-md items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 shadow-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-zinc-300"></div>
            <p className="text-sm font-medium text-zinc-400">로그인 폼 로딩 중...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
