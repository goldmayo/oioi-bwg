import "server-only";

import type { RequestAuthorization } from "@/server/auth/request-context";

import { getSentryRouteMetadata } from "@/shared/lib/sentry-route-metadata";

const reasons = [
  "no_valid_identity",
  "mfa_proof_missing",
  "invalid_identity",
  "authorization_facts_missing",
  "account_inactive",
  "admin_role_required",
  "mfa_disabled",
  "mfa_version_mismatch",
  "credentials_rejected",
  "unknown",
] as const;
const credentialsReported = new WeakSet<Error>();
type Outcome =
  | "response_created"
  | "login_redirect_requested"
  | "access_denied_requested"
  | "action_rejection_returned"
  | "unknown";

/** request-cached 객체의 작은 enum만 읽는다. 사용자/context 원문이나 Sentry 호출은 기록하지 않는다. */
export function logAuthRejection(
  authorization: RequestAuthorization | undefined,
  outcome: Outcome,
  source: "admin-rsc" | "api-route-handler" | "upload-album-image-action" | "auth-js",
  options: { status?: 401 | 403; route?: string; credentials?: boolean } = {},
) {
  if (authorization?.rejectionLogged) return;
  if (authorization) authorization.rejectionLogged = true;
  const decision = options.credentials ? "credentials_rejected" : authorization?.decision;
  const reason = reasons.find((candidate) => candidate === decision) ?? "unknown";
  const route = getSentryRouteMetadata(options.route);
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "auth.rejected",
      app: "console",
      runtime: "node",
      source,
      reason,
      handling: "handled",
      outcome,
      ...(options.status ? { "http.status_code": options.status } : {}),
      ...(route ? { route: { template: route.template }, operation: route.operation } : {}),
    }),
  );
}

export function logCredentialsRejection(error: Error) {
  if (credentialsReported.has(error)) return;
  credentialsReported.add(error);
  logAuthRejection(undefined, "unknown", "auth-js", {
    credentials: true,
    route: "/api/auth/[...nextauth]",
  });
}
