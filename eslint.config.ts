import { fileURLToPath } from "node:url";
import { defineConfig } from "eslint/config";

import { createAppConfig } from "@oioi-bwg/config/eslint/app";
import { createContractsConfig } from "@oioi-bwg/config/eslint/contracts";
import { createNodeConfig } from "@oioi-bwg/config/eslint/node";
import { createServerConfig } from "@oioi-bwg/config/eslint/server";
import { createWorkerConfig } from "@oioi-bwg/config/eslint/worker";

const root = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig([
  ...createNodeConfig(root("./")),
  ...createAppConfig(root("./apps/web/")),
  ...createAppConfig(root("./apps/console/")),
  ...createWorkerConfig(root("./apps/sentry-slack-relay/")),
  ...createServerConfig(root("./packages/server/")),
  ...createContractsConfig(root("./packages/contracts/")),
]);
