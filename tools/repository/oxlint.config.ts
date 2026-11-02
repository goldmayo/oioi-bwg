import { createOxlintConfig } from "@oioi-bwg/config/oxlint";

function createRepositoryOxlintConfig() {
  const config = createOxlintConfig([
    "apps/web/src/**/*.{ts,tsx}",
    "apps/console/src/**/*.{ts,tsx}",
  ]);
  return {
    ...config,
    ignorePatterns: [
      ...(config.ignorePatterns ?? []),
      ".agents/**",
      ".local/**",
      "docs/migration/harness/**",
    ],
  };
}

export default createRepositoryOxlintConfig();
