import config from "./tools/repository/oxlint.config.ts";

export default {
  ...config,
  options: {
    typeAware: true,
    reportUnusedDisableDirectives: "warn" as const,
  },
};
