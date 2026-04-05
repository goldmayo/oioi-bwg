"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-data";

/**
 * GNB의 상태(현재 활성화된 경로)만 담당하는 클라이언트 컴포넌트
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2" suppressHydrationWarning>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`flex items-center gap-2 px-3 py-1 text-sm font-bold transition-all ${
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon size={18} className={isActive ? "text-foreground" : ""} />
          </Link>
        );
      })}
    </nav>
  );
}
