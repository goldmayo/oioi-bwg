import { fileURLToPath } from "node:url";

import { createContractsConfig } from "../../config/eslint/contracts.ts";

export default createContractsConfig(fileURLToPath(new URL(".", import.meta.url)));
