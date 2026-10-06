import type { ErrorEvent } from "@sentry/nextjs";

const SENTRY_RELEASE_PATTERN = /^oioi-bwg@[0-9a-f]{40}$/;
const SENTRY_DEBUG_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DEBUG_IMAGES = 128;

function readProperty(value: unknown, key: PropertyKey): unknown {
  if ((typeof value !== "object" && typeof value !== "function") || value === null)
    return undefined;

  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

function safeBuildPath(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1024 ||
    /[\r\n]/.test(value)
  )
    return undefined;

  const withoutDetails = value.split(/[?#]/, 1)[0];
  if (!withoutDetails) return undefined;

  let path = withoutDetails;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return undefined;
    }
  }

  const publicAssetIndex = path.indexOf("/_next/");
  if (publicAssetIndex >= 0) return path.slice(publicAssetIndex);

  const serverAssetIndex = path.indexOf("/.next/");
  if (serverAssetIndex >= 0) return path.slice(serverAssetIndex + 1);

  if (path.startsWith("_next/")) return `/${path}`;
  if (path.startsWith(".next/")) return path;

  return undefined;
}

/** Build artifact paths are reduced to public `/_next/` or private `.next/` relative paths. */
export function toSafeSentryBuildPath(value: unknown): string | undefined {
  return safeBuildPath(value);
}

function safeDebugMeta(event: ErrorEvent): ErrorEvent["debug_meta"] | undefined {
  const images = readProperty(readProperty(event, "debug_meta"), "images");
  if (!Array.isArray(images)) return undefined;

  const safeImages = images.slice(0, MAX_DEBUG_IMAGES).flatMap((image) => {
    if (readProperty(image, "type") !== "sourcemap") return [];

    const codeFile = safeBuildPath(readProperty(image, "code_file"));
    const debugId = readProperty(image, "debug_id");
    if (!codeFile || typeof debugId !== "string" || !SENTRY_DEBUG_ID_PATTERN.test(debugId))
      return [];

    return [{ type: "sourcemap" as const, code_file: codeFile, debug_id: debugId }];
  });

  return safeImages.length > 0 ? { images: safeImages } : undefined;
}

/** Preserve only immutable build correlation fields required for Sentry source map resolution. */
export function toSafeSentryBuildMetadata(event: ErrorEvent) {
  const release =
    typeof event.release === "string" && SENTRY_RELEASE_PATTERN.test(event.release)
      ? event.release
      : undefined;
  const debugMeta = safeDebugMeta(event);

  return {
    ...(release ? { release } : {}),
    ...(debugMeta ? { debug_meta: debugMeta } : {}),
  };
}
