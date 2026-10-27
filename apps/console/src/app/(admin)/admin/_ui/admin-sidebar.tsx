"use client";

import { Bell, Disc3, LayoutDashboard, Music } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminSidebarShell } from "./admin-sidebar-shell";

const ADMIN_NAV = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/albums", label: "앨범 관리", icon: Disc3 },
  { href: "/admin/songs", label: "곡 관리", icon: Music },
  { href: "/admin/notifications", label: "알림 내역", icon: Bell },
] as const;

export default function AdminSidebar() {
  const pathname = usePathname();
  const navContent = (
    <nav aria-label="관리자 메뉴" className="flex flex-col gap-1">
      {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          (href !== "/admin" && pathname.startsWith(`${href}/`)) ||
          (href === "/admin/songs" && pathname.startsWith("/admin/edit/")) ||
          (href === "/admin/notifications" && pathname.startsWith("/admin/waveform-jobs/"));
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={label}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors group-data-[collapsed=true]/sidebar:justify-center ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className="group-data-[collapsed=true]/sidebar:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return <AdminSidebarShell>{navContent}</AdminSidebarShell>;
}
