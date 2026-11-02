"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import { getAdminBreadcrumbs } from "../_config/admin-navigation";

type Location = { pathname: string; title: string } | null;
const context = createContext<{
  location: Location;
  setLocation: Dispatch<SetStateAction<Location>>;
} | null>(null);

export function AdminLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(null);
  const value = useMemo(() => ({ location, setLocation }), [location]);
  return <context.Provider value={value}>{children}</context.Provider>;
}

/** 페이지가 이미 조회한 제목만 제공한다. 헤더는 도메인 데이터를 다시 조회하지 않는다. */
export function AdminPageLocation({ title }: { title: string }) {
  const owner = useContext(context);
  const pathname = usePathname();
  const setLocation = owner?.setLocation;
  useEffect(() => {
    const entry = { pathname, title };
    setLocation?.(entry);
    return () => setLocation?.((current) => (current === entry ? null : current));
  }, [setLocation, pathname, title]);
  return null;
}

export function useAdminBreadcrumbs() {
  const owner = useContext(context);
  const pathname = usePathname();
  return getAdminBreadcrumbs(
    pathname,
    owner?.location?.pathname === pathname ? owner.location.title : undefined,
  );
}
