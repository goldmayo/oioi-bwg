"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const key = "overlay";
const marker = "consoleFilterOverlay";
let documentToken: string | undefined;

export function useFilterOverlay(id: string) {
  const search = useSearchParams();
  const pathname = usePathname();
  const open = search?.get(key) === id;
  const closing = useRef(false);

  useEffect(() => {
    closing.current = false;
  }, [open, pathname]);

  function show() {
    const url = new URL(location.href);
    if (url.searchParams.get(key) === id) return;
    documentToken ??= crypto.randomUUID();
    const replacing = url.searchParams.has(key);
    url.searchParams.set(key, id);
    if (replacing) {
      history.replaceState({ [marker]: history.state?.[marker] }, "", url);
    } else {
      history.pushState({ [marker]: documentToken }, "", url);
    }
  }

  function close({
    afterClose,
    replace = false,
  }: { afterClose?: () => void; replace?: boolean } = {}) {
    const url = new URL(location.href);
    if (closing.current || url.pathname !== pathname || url.searchParams.get(key) !== id) return;
    closing.current = true;
    if (!replace && documentToken && history.state?.[marker] === documentToken) {
      if (afterClose) window.addEventListener("popstate", afterClose, { once: true });
      history.back();
      return;
    }
    url.searchParams.delete(key);
    history.replaceState(null, "", url);
    afterClose?.();
  }

  return { open, show, close };
}
