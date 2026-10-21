import { fileURLToPath } from "node:url";

import { createServerConfig } from "../../config/eslint/server.mjs";

export default createServerConfig(fileURLToPath(new URL(".", import.meta.url)));
