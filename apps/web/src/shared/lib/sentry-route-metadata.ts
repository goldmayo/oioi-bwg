/** 앱이 소유한 경로만 고정 template/operation으로 축약한다. 원문 경로는 반환하지 않는다. */
const routes = {
  "/": "web-home",
  "/chants": "public-chant-list",
  "/songs/[slug]": "public-song-detail",
  "/albums/[slug]": "public-album-detail",
  "/more": "public-more",
  "/more/notice": "public-notice",
  "/more/updates": "public-updates",
  "/more/report": "public-report",
  "/more/policy": "public-policy-list",
  "/more/policy/[slug]": "public-policy-detail",
  "/api/songs/[slug]": "public-song-api",
  "/api/albums/[slug]": "public-album-api",
} as const;

export const SENTRY_OPERATIONS = ["album-image-upload", ...Object.values(routes)] as const;

const dynamicRoutes: readonly [RegExp, keyof typeof routes][] = [
  [/^\/songs\/[^/]+$/, "/songs/[slug]"],
  [/^\/albums\/[^/]+$/, "/albums/[slug]"],
  [/^\/api\/songs\/[^/]+$/, "/api/songs/[slug]"],
  [/^\/api\/albums\/[^/]+$/, "/api/albums/[slug]"],
  [/^\/more\/policy\/[^/]+$/, "/more/policy/[slug]"],
];

export function getSentryRouteMetadata(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  let path: string;
  try {
    path = /^https?:\/\//.test(value) ? new URL(value).pathname : value.split(/[?#]/, 1)[0];
  } catch {
    return undefined;
  }
  path = path.replace(/^\/\(user\)(?=\/)/, "");
  const template =
    Object.keys(routes).find((candidate) => candidate === path) ??
    dynamicRoutes.find(([pattern]) => pattern.test(path))?.[1];
  if (!template) return undefined;
  const entry = Object.entries(routes).find(([candidate]) => candidate === template);
  return entry ? { template: entry[0], operation: entry[1] } : undefined;
}
