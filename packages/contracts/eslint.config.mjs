import { fileURLToPath } from "node:url";

import { createContractsConfig } from "../../config/eslint/contracts.mjs";

export default createContractsConfig(fileURLToPath(new URL(".", import.meta.url)));
