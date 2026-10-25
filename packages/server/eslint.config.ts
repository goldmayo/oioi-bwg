import { fileURLToPath } from "node:url";

import { createServerConfig } from "@oioi-bwg/config/eslint/server";

export default createServerConfig(fileURLToPath(new URL(".", import.meta.url)));
