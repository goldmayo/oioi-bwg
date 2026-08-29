import { Disc3, Music } from "lucide-react";
import Link from "next/link";

import { SidebarWrapper } from "./sidebar-wrapper";

const ADMIN_NAV = [
  { href: "/admin/albums", label: "앨범 관리", icon: Disc3 },
  { href: "/admin/songs", label: "곡 관리", icon: Music },
] as const;

/**
 * 관리자 사이드바 (서버 컴포넌트)
 * 앨범 관리 / 곡 관리 메뉴만 표시
 */
export default function AdminSidebar() {
  const navContent = (
    <nav className="flex flex-col gap-1">
      {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          prefetch={false}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );

  return <SidebarWrapper>{navContent}</SidebarWrapper>;
}
