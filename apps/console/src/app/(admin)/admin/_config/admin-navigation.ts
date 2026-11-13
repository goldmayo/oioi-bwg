import { Bell, Disc3, Headphones, LayoutDashboard, Megaphone } from "lucide-react";

import { type AdminPageId, adminPaths } from "@/shared/config/admin-routes";

const sections = {
  dashboard: { href: adminPaths.dashboard, label: "대시보드", icon: LayoutDashboard },
  albums: { href: adminPaths.albumList, label: "앨범 관리", icon: Disc3 },
  songs: { href: adminPaths.songList, label: "곡 관리", icon: Headphones },
  guides: { href: adminPaths.guideList, label: "응원법 관리", icon: Megaphone },
  notifications: { href: adminPaths.notificationList, label: "알림 내역", icon: Bell },
};
type SectionId = keyof typeof sections;
const menuOrder: readonly SectionId[] = ["dashboard", "albums", "songs", "guides", "notifications"];
export const ADMIN_NAV = menuOrder.map((id) => sections[id]);

const pages: Record<AdminPageId, { section: SectionId; title?: string }> = {
  dashboard: { section: "dashboard" },
  dashboardSettings: { section: "dashboard", title: "대시보드 관리" },
  albumList: { section: "albums" },
  albumCreate: { section: "albums", title: "앨범 추가" },
  albumEdit: { section: "albums", title: "앨범 정보 수정" },
  songList: { section: "songs" },
  songCreate: { section: "songs", title: "곡 추가" },
  songDetail: { section: "songs", title: "곡 정보" },
  songLyrics: { section: "songs", title: "가사 편집" },
  guideList: { section: "guides" },
  guideCreate: { section: "guides", title: "응원법 추가" },
  guideEdit: { section: "guides", title: "응원법 편집" },
  notificationList: { section: "notifications" },
  waveformJob: { section: "notifications", title: "파형 생성 결과" },
};
export interface AdminBreadcrumb {
  label: string;
  href?: string;
}

export function getAdminNavigation(pageId: AdminPageId | undefined, pageTitle?: string) {
  const root = { label: "콘솔", href: adminPaths.dashboard };
  if (!pageId) return { section: undefined, breadcrumbs: [root, { label: "관리자 페이지" }] };
  const page = pages[pageId];
  const section = sections[page.section];
  let breadcrumbs: AdminBreadcrumb[] = [root, { label: section.label }];
  if (pageId === "dashboard") breadcrumbs = [{ label: "콘솔" }];
  else if (adminPaths[pageId] !== section.href)
    breadcrumbs = [
      root,
      { label: section.label, href: section.href },
      { label: pageTitle ?? page.title ?? section.label },
    ];
  return { section, breadcrumbs };
}
