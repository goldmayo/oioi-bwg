/** 앱이 소유한 경로만 고정 template/operation으로 축약한다. 원문 경로는 반환하지 않는다. */
const routes = {
  "/api/admin/push-installations": "admin-push-registration-api",
  "/api/admin/push-installations/[id]": "admin-push-unregister-api",
  "/api/admin/notifications": "admin-notifications-api",
  "/api/admin/notifications/[id]": "admin-notification-api",
  "/api/admin/notifications/[id]/read": "admin-notification-read-api",
  "/api/admin/notifications/read-all": "admin-notifications-read-all-api",
  "/admin": "admin-home",
  "/admin/notifications": "admin-notification-list",
  "/admin-login": "admin-login",
  "/admin/albums": "admin-album-list",
  "/admin/songs": "admin-song-list",
  "/admin/edit/[slug]": "admin-song-edit-load",
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
  [/^\/api\/admin\/push-installations\/[^/]+$/, "/api/admin/push-installations/[id]"],
  [/^\/api\/admin\/notifications\/[^/]+\/read$/, "/api/admin/notifications/[id]/read"],
  [/^\/api\/admin\/notifications\/[^/]+$/, "/api/admin/notifications/[id]"],
  [/^\/admin\/edit\/[^/]+$/, "/admin/edit/[slug]"],
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
  const template =
    Object.keys(routes).find((candidate) => candidate === path) ??
    dynamicRoutes.find(([pattern]) => pattern.test(path))?.[1];
  if (!template) return undefined;
  const entry = Object.entries(routes).find(([candidate]) => candidate === template);
  return entry ? { template: entry[0], operation: entry[1] } : undefined;
}
