import { adminPaths, getAdminPageId } from "@/shared/config/admin-routes";

/** 앱이 소유한 경로만 고정 template/operation으로 축약한다. 원문 경로는 반환하지 않는다. */
const routes = {
  "/api/operator/songs/resolve": "operator-song-resolve-api",
  "/api/operator/songs/[id]/waveform": "operator-song-waveform-api",
  "/operator-connect": "operator-connect",
  "/api/operator/auth/device": "operator-auth-device-api",
  "/api/operator/auth/token": "operator-auth-token-api",
  "/api/operator/auth/approve": "operator-auth-approve-api",
  "/api/operator/auth/session": "operator-auth-session-api",
  "/api/operator/auth/revoke": "operator-auth-revoke-api",

  "/api/admin/push-installations": "admin-push-registration-api",
  "/api/admin/push-installations/[id]": "admin-push-unregister-api",
  "/api/admin/notifications": "admin-notifications-api",
  "/api/admin/notifications/[id]": "admin-notification-api",
  "/api/admin/notifications/[id]/read": "admin-notification-read-api",
  "/api/admin/notifications/read-all": "admin-notifications-read-all-api",
  [adminPaths.waveformJob]: "admin-waveform-job",
  "/api/admin/waveform-jobs/[id]": "admin-waveform-job-api",
  [adminPaths.dashboard]: "admin-home",
  [adminPaths.notificationList]: "admin-notification-list",
  "/admin-login": "admin-login",
  [adminPaths.albumList]: "admin-album-list",
  [adminPaths.albumCreate]: "admin-album-create",
  [adminPaths.albumEdit]: "admin-album-edit",
  [adminPaths.songList]: "admin-song-list",
  [adminPaths.songLyrics]: "admin-song-edit-load",
  [adminPaths.guideEdit]: "admin-cheer-guide-edit-load",
  "/api/admin/cheer-guides/[id]/draft": "admin-cheer-guide-draft-api",
  "/api/admin/albums": "admin-albums-api",
  "/api/admin/albums/[id]": "admin-album-api",
  "/api/admin/songs": "admin-songs-api",
  "/api/admin/songs/[id]": "admin-song-api",
  "/api/admin/songs/[id]/lyrics": "admin-song-lyrics-api",
  "/api/auth/ability": "admin-ability",
  "/api/auth/mfa/setup": "admin-mfa-setup",
  "/api/auth/mfa/confirm": "admin-mfa-confirm",
  "/api/auth/[...nextauth]": "admin-auth",
} as const;

export const SENTRY_OPERATIONS = ["album-image-upload", ...Object.values(routes)] as const;

const dynamicRoutes: readonly [RegExp, keyof typeof routes][] = [
  [/^\/api\/operator\/songs\/[^/]+\/waveform$/, "/api/operator/songs/[id]/waveform"],
  [/^\/api\/admin\/waveform-jobs\/[^/]+$/, "/api/admin/waveform-jobs/[id]"],
  [/^\/api\/admin\/push-installations\/[^/]+$/, "/api/admin/push-installations/[id]"],
  [/^\/api\/admin\/notifications\/[^/]+\/read$/, "/api/admin/notifications/[id]/read"],
  [/^\/api\/admin\/notifications\/[^/]+$/, "/api/admin/notifications/[id]"],
  [/^\/api\/admin\/cheer-guides\/[^/]+\/draft$/, "/api/admin/cheer-guides/[id]/draft"],
  [/^\/api\/admin\/albums\/[^/]+$/, "/api/admin/albums/[id]"],
  [/^\/api\/admin\/songs\/[^/]+\/lyrics$/, "/api/admin/songs/[id]/lyrics"],
  [/^\/api\/admin\/songs\/[^/]+$/, "/api/admin/songs/[id]"],
  [
    /^\/api\/auth\/(?:session|csrf|providers|signin|signout|error|callback\/credentials)$/,
    "/api/auth/[...nextauth]",
  ],
];

export function getSentryRouteMetadata(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  let path: string;
  try {
    path = /^https?:\/\//.test(value) ? new URL(value).pathname : value.split(/[?#]/, 1)[0];
  } catch {
    return undefined;
  }
  path = path.replace(/^\/\(admin\)(?=\/)/, "");
  const templates = Object.keys(routes);
  let template = templates.find((candidate) => candidate === path);
  if (!template) {
    const pageId = getAdminPageId(path);
    if (pageId && templates.includes(adminPaths[pageId])) template = adminPaths[pageId];
  }
  template ??= dynamicRoutes.find(([pattern]) => pattern.test(path))?.[1];
  if (!template) return undefined;
  const entry = Object.entries(routes).find(([candidate]) => candidate === template);
  return entry ? { template: entry[0], operation: entry[1] } : undefined;
}
