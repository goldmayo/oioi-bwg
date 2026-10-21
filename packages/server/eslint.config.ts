import { fileURLToPath } from "node:url";

import { createServerConfig } from "../../config/eslint/server.ts";

export default createServerConfig(fileURLToPath(new URL(".", import.meta.url)));
