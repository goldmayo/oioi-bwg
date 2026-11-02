import { useCallback, useEffect, useRef, useState } from "react";

import { useNavigationBlocker } from "@/shared/model/navigation-confirmation";

/** 이 폼의 문서 탐색만 보호한다. History API나 다른 화면의 라우터를 변경하지 않는다. */
export function useSongLeaveConfirmation(dirty: boolean) {
  const allowed = useRef(false);
  const [destination, setDestination] = useState<{ navigate: () => void; unload: boolean } | null>(
    null,
  );
  const requestLeave = useCallback(
    (navigate: () => void, unload = true) => {
      if (dirty && !allowed.current) setDestination({ navigate, unload });
      else navigate();
    },
    [dirty],
  );
  const blockNavigation = useCallback(
    (navigate: () => void) => requestLeave(navigate, false),
    [requestLeave],
  );
  useNavigationBlocker(dirty ? blockNavigation : null);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const followLink = (event: MouseEvent) => {
      if (
        allowed.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const url = new URL(anchor.href);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        (url.origin === location.origin &&
          url.pathname === location.pathname &&
          url.search === location.search)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      requestLeave(() => window.location.assign(url.href));
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
    };
  }, [dirty, requestLeave]);
  return {
    open: destination !== null,
    requestLeave,
    stay: () => setDestination(null),
    release: () => {
      allowed.current = true;
    },
    leave: () => {
      if (!destination) return;
      allowed.current = destination.unload;
      setDestination(null);
      destination.navigate();
    },
  };
}
