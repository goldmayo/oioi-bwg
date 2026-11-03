import { fileURLToPath } from "node:url";

import { createWorkerLocalImportRule } from "./worker-rule.ts";

const root = fileURLToPath(new URL("../../../apps/sentry-slack-relay/", import.meta.url));

export default {
  meta: { name: "worker-boundary" },
  rules: { "local-import": createWorkerLocalImportRule(root) },
};
