"use client";

import { Button } from "@/shared/ui/button";

import type { useAdminReauthentication } from "../model/use-admin-reauthentication";

export function AdminReauthenticationNotice({
  recovery,
}: {
  recovery: ReturnType<typeof useAdminReauthentication>;
}) {
  if (!recovery.requiresReauthentication) return null;
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 mb-4 rounded-md border p-4 text-sm"
    >
      <p>{recovery.message}</p>
      <p className="mt-1">새 탭에서 다시 로그인한 뒤 로그인 상태 확인을 눌러주세요.</p>
      <div className="mt-3 flex items-center gap-4">
        <a href="/admin-login" target="_blank" rel="noopener noreferrer" className="underline">
          다시 로그인
        </a>
        <Button type="button" variant="outline" onClick={() => void recovery.checkAuthentication()}>
          로그인 상태 확인
        </Button>
      </div>
    </div>
  );
}
