import { getSentryRouteMetadata } from "../sentry-route-metadata";

export const INTERNAL_REQUEST_ID = "x-oioi-request-id";
export const INTERNAL_ROUTE_TEMPLATE = "x-oioi-route-template";
const errorRequestIds = new WeakMap<object, string>();

export function toSafeRequestId(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}
export function toSafeEventId(value: unknown): string | undefined {
  return typeof value === "string" && /^[0-9a-f]{32}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}
function readHeader(headers: unknown, name: string): unknown {
  if (typeof headers !== "object" || headers === null) return undefined;
  try {
    const get = Reflect.get(headers, "get");
    return typeof get === "function" ? get.call(headers, name) : Reflect.get(headers, name);
  } catch {
    return undefined;
  }
}
export function readRequestObservation(headers: unknown, expectedRoute?: string) {
  const requestId = toSafeRequestId(readHeader(headers, INTERNAL_REQUEST_ID));
  const route = getSentryRouteMetadata(readHeader(headers, INTERNAL_ROUTE_TEMPLATE));
  if (
    !requestId ||
    !route ||
    ![
      "/",
      "/chants",
      "/songs/[slug]",
      "/albums/[slug]",
      "/api/songs/[slug]",
      "/api/albums/[slug]",
    ].includes(route.template) ||
    (expectedRoute !== undefined && expectedRoute !== route.template)
  )
    return {};
  return { requestId, route: route.template };
}
export type RequestObservation = ReturnType<typeof readRequestObservation>;

export function rememberErrorRequestId(error: Error, value: unknown): Error {
  const requestId = toSafeRequestId(value);
  if (requestId) errorRequestIds.set(error, requestId);
  return error;
}
export function getErrorRequestId(error: unknown) {
  return typeof error === "object" && error !== null ? errorRequestIds.get(error) : undefined;
}
