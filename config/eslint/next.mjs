import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettierConfig from "eslint-config-prettier";

import { baseConfig } from "./base.mjs";

export const nextConfig = defineConfig([...nextVitals, ...baseConfig, prettierConfig]);

export default nextConfig;
