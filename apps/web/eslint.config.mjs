import { fileURLToPath } from "node:url";

import { createAppConfig } from "../../config/eslint/app.mjs";

export default createAppConfig(fileURLToPath(new URL(".", import.meta.url)));
