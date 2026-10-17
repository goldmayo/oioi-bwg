import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["./src/app/**", "./src/shared/**"],
    rules: {
      "fsd/public-api": "off",
    },
  },
  {
    rules: {
      // shared는 segment 직접 import를 허용하고 promoted slice public API는 ESLint가 검사한다.
      "fsd/no-public-api-sidestep": "off",
      // Next convention(app/providers) 오탐을 피하고 segment vocabulary는 ESLint가 검사한다.
      "fsd/segments-by-purpose": "off",
    },
  },
]);
