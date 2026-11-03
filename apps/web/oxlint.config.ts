import { fileURLToPath } from "node:url";

import { createAppConfig } from "@oioi-bwg/config/oxlint/app";

import manifest from "./package.json" with { type: "json" };

export default createAppConfig(
  fileURLToPath(new URL("./", import.meta.url)),
  manifest.dependencies.react,
);
