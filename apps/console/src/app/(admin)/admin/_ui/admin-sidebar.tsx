"use client";

import Link from "next/link";

import { ADMIN_NAV } from "../_config/admin-navigation";

export default function AdminSidebar({ activeHref }: { activeHref?: string }) {
  return (
    <nav aria-label="관리자 메뉴" className="flex flex-col gap-0.5">
      {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={label}
            className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors group-data-[collapsed=true]/sidebar:justify-center md:min-h-8 md:gap-2 md:px-2 md:text-[13px] ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"}`}
          >
            <Icon className="size-5 shrink-0 md:size-4" aria-hidden="true" />
            <span className="group-data-[collapsed=true]/sidebar:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
