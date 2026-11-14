/** Console 화면 URL의 정의다. API 주소·메뉴·권한 정책은 각 소유 경계에 둔다. */
export const adminPaths = {
  dashboard: "/admin",
  dashboardSettings: "/admin/dashboard/settings",
  albumList: "/admin/albums",
  albumCreate: "/admin/albums/new",
  albumEdit: "/admin/albums/[id]/edit",
  songList: "/admin/songs",
  songCreate: "/admin/songs/new",
  songDetail: "/admin/songs/[id]",
  songLyrics: "/admin/edit/[slug]",
  guideList: "/admin/cheer-guides",
  guideCreate: "/admin/cheer-guides/new",
  guideEdit: "/admin/cheer-guides/[id]/edit",
  notificationList: "/admin/notifications",
  waveformJob: "/admin/waveform-jobs/[id]",
} as const;

export type AdminPageId = keyof typeof adminPaths;
const pageIds = Object.keys(adminPaths) as AdminPageId[];

export function getAdminPageId(pathname: string): AdminPageId | undefined {
  const exact = pageIds.find((id) => adminPaths[id] === pathname);
  if (exact) return exact;
  const actual = pathname.split("/");
  return pageIds.find((id) => {
    const expected = adminPaths[id].split("/");
    if (expected.length !== actual.length) return false;
    return expected.every((part, index) => {
      if (part === "[id]" || part === "[slug]") return actual[index].length > 0;
      return part === actual[index];
    });
  });
}

function withParameter(template: string, value: string) {
  return template.replace(/\[(?:id|slug)\]/, encodeURIComponent(value));
}

function song(id: string) {
  return withParameter(adminPaths.songDetail, id);
}

export const adminLinks = {
  albumEdit: (id: string) => withParameter(adminPaths.albumEdit, id),
  song,
  waveformJob: (id: string) => withParameter(adminPaths.waveformJob, id),
  songEdit: (id: string) => `${song(id)}?edit=true`,
  songGuides: (id: string) => `${song(id)}#song-guides`,
  guideCreate: (songId?: string) => {
    if (!songId) return adminPaths.guideCreate;
    return `${adminPaths.guideCreate}?${new URLSearchParams({ songId })}`;
  },
  guideEdit: (id: string, returnTo: string) =>
    `${withParameter(adminPaths.guideEdit, id)}?${new URLSearchParams({ returnTo })}`,
  songLyrics: (slug: string, guideId?: string) => {
    const path = withParameter(adminPaths.songLyrics, slug);
    if (!guideId) return path;
    return `${path}?${new URLSearchParams({ guideId })}`;
  },
};
