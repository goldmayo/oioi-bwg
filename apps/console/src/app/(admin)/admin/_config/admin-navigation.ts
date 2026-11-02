import { Bell, Disc3, LayoutDashboard, Megaphone, Music } from "lucide-react";

export const ADMIN_NAV = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/albums", label: "앨범 관리", icon: Disc3 },
  { href: "/admin/songs", label: "곡 관리", icon: Music },
  { href: "/admin/cheer-guides", label: "응원법 관리", icon: Megaphone },
  { href: "/admin/notifications", label: "알림 내역", icon: Bell },
] as const;

export interface AdminBreadcrumb {
  label: string;
  href?: string;
}

export function getAdminSection(pathname: string) {
  if (pathname === "/admin") return ADMIN_NAV[0];
  return pathname.startsWith("/admin/edit/")
    ? ADMIN_NAV[2]
    : pathname.startsWith("/admin/waveform-jobs/")
      ? ADMIN_NAV[4]
      : ADMIN_NAV.slice(1).find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
}

export function getAdminBreadcrumbs(pathname: string, pageTitle?: string): AdminBreadcrumb[] {
  if (pathname === "/admin") return [{ label: "Console" }];
  const section = getAdminSection(pathname);
  const root = { label: "Console", href: "/admin" };
  if (!section) return [root, { label: "관리자 페이지" }];
  if (pathname === section.href) return [root, { label: section.label }];
  const fallback =
    pathname === "/admin/songs/new"
      ? "곡 추가"
      : pathname === "/admin/cheer-guides/new"
        ? "응원법 추가"
        : pathname.startsWith("/admin/waveform-jobs/")
          ? "파형 생성 결과"
          : pathname.startsWith("/admin/edit/")
            ? "가사 편집"
            : section.href === "/admin/cheer-guides"
              ? "응원법 편집"
              : "곡 정보";
  return [root, { label: section.label, href: section.href }, { label: pageTitle ?? fallback }];
}
