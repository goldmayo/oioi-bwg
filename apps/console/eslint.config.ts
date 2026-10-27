import { fileURLToPath } from "node:url";

import { createAppConfig } from "@oioi-bwg/config/eslint/app";

export default [
  { ignores: ["public/notification-worker.js"] },
  ...createAppConfig(fileURLToPath(new URL(".", import.meta.url))),
];
