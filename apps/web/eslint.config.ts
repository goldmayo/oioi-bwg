import { fileURLToPath } from "node:url";

import { createAppConfig } from "@oioi-bwg/config/eslint/app";

export default createAppConfig(fileURLToPath(new URL(".", import.meta.url)));
