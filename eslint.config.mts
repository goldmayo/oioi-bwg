import { fileURLToPath } from "node:url";
import { defineConfig } from "eslint/config";

import { createAppConfig } from "./config/eslint/app.mjs";
import { createContractsConfig } from "./config/eslint/contracts.mjs";
import nodeConfig from "./config/eslint/node.mjs";
import { createServerConfig } from "./config/eslint/server.mjs";

const root = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig([
  ...nodeConfig,
  ...createAppConfig(root("./apps/web/")),
  ...createAppConfig(root("./apps/console/")),
  ...createServerConfig(root("./packages/server/")),
  ...createContractsConfig(root("./packages/contracts/")),
]);
