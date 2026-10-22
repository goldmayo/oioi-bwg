import { fileURLToPath } from "node:url";

import { createContractsConfig } from "@oioi-bwg/config/eslint/contracts";

export default createContractsConfig(fileURLToPath(new URL(".", import.meta.url)));
