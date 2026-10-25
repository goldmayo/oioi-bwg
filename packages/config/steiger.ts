import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export function createSteigerConfig(sourceRoot: string) {
  return defineConfig([
    ...fsd.configs.recommended,
    {
      files: [`${sourceRoot}/app/**`, `${sourceRoot}/shared/**`],
      rules: { "fsd/public-api": "off" },
    },
    {
      rules: {
        // public entry와 segment vocabulary는 공통 ESLint 규칙이 검사한다.
        "fsd/no-public-api-sidestep": "off",
        "fsd/segments-by-purpose": "off",
      },
    },
  ]);
}
