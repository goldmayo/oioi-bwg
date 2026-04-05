"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-data";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-background/90 fixed bottom-0 left-0 z-50 flex h-[68px] w-full items-center justify-around border-t backdrop-blur-xl md:hidden pb-safe" suppressHydrationWarning>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`flex h-full w-full flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div
              className={`flex items-center justify-center rounded-full p-1 transition-all ${
                isActive ? "bg-foreground/10" : "bg-transparent"
              }`}
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] font-bold ${isActive ? "opacity-100" : "opacity-70"}`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
