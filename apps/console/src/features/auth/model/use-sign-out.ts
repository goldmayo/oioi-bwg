"use client";

import { useRef, useState } from "react";

import { captureClientErrorOnce } from "@/shared/api/capture-client-error";
import { useConfirmNavigation } from "@/shared/model/navigation-confirmation";

import { signOut } from "../api/actions";

export function useSignOut() {
  const confirmNavigation = useConfirmNavigation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function execute() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await signOut();
    } catch {
      captureClientErrorOnce(new Error("Console sign-out request failed"), {
        source: "admin-sign-out",
      });
      setError("로그아웃하지 못했습니다. 다시 시도해 주세요.");
      setOpen(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return {
    open,
    pending,
    error,
    request: () => {
      if (inFlight.current) return;
      setError(null);
      setOpen(true);
    },
    cancel: () => setOpen(false),
    confirm: () => {
      if (inFlight.current) return;
      setOpen(false);
      confirmNavigation(() => void execute());
    },
  };
}
