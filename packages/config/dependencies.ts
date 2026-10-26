import type { ICruiseOptions, ICruiseResult, IForbiddenRuleType } from "dependency-cruiser";

export interface WorkspaceDependencyOwner {
  directory: string;
  name: string;
  dependencies: Record<string, string>;
  exports?: Record<string, string>;
}

const rootToolEntries: Record<string, string> = {
  "eslint.config.ts": "./eslint",
  "steiger.config.ts": "./steiger",
  "scripts/check-workspace-dependencies.ts": "./cli/dependencies",
  "scripts/plan-uuid-cutover.ts": "./cli/plan-uuid-cutover",
  "scripts/import-cheer-guides.ts": "./cli/import-cheer-guides",
  "scripts/console-admin-bootstrap.ts": "./cli/console-admin-bootstrap",
  "scripts/run-drizzle-migrations.ts": "./migration/uuid-cutover-map",
  "scripts/console-mfa-execution.ts": "./operator/execution",
  "scripts/console-mfa-operator-policy.ts": "./operator/policy",
  "tests/ops/console-mfa-fixture.ts": "./fixture/console-mfa",
  "tests/integration/vitest.config.ts": "./vitest/postgres",
};

const testFiles = "\\.(?:test|spec)\\.[cm]?[jt]sx?$";
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function dependencyOptions(
  root: string,
  tsconfig: string | undefined,
  owners: WorkspaceDependencyOwner[],
  clients: string[],
): ICruiseOptions {
  const forbidden: IForbiddenRuleType[] = [
    {
      name: "packages-to-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "root-to-apps",
      severity: "error",
      from: {
        pathNot: [
          "^(?:apps|packages)/",
          "^tools/repository/tests/integration/m7-foundation\\.postgres\\.test\\.ts$",
        ],
      },
      to: { path: "^apps/" },
    },
    {
      name: "foundation-app-adapter",
      severity: "error",
      from: { path: "^tools/repository/tests/integration/m7-foundation\\.postgres\\.test\\.ts$" },
      to: { path: "^apps/", pathNot: "^apps/web/src/server/http/api-response\\.ts$" },
    },
    ...owners
      .filter(({ directory }) => directory.startsWith("apps/"))
      .map(({ directory }) => ({
        name: "cross-app-" + directory.slice(5),
        severity: "error" as const,
        from: { path: "^" + escape(directory) + "/" },
        to: { path: "^apps/", pathNot: "^" + escape(directory) + "/" },
      })),
    {
      name: "runtime-tooling",
      severity: "error",
      from: {
        path: [
          "^(?:apps/[^/]+|packages/(?:server|contracts|ui))/src/",
          "^apps/[^/]+/sentry\\.[^/]+\\.config\\.[cm]?ts$",
        ],
        pathNot: testFiles,
      },
      to: { path: "^(?:packages/config|tools/repository)/" },
    },
    {
      name: "client-server-core",
      severity: "error",
      from: {
        path: [
          "^apps/[^/]+/src/(?:widgets|features|entities|shared)/",
          "^packages/ui/src/",
          ...clients.map((file) => "^" + escape(file) + "$"),
        ],
        pathNot: testFiles,
      },
      to: { path: "^packages/server/" },
    },
    {
      name: "contracts-runtime",
      severity: "error",
      from: { path: "^packages/contracts/src/", pathNot: testFiles },
      to: { pathNot: "^packages/contracts/src/|(?:^|/)node_modules/zod(?:/|$)" },
    },
    {
      name: "ui-domain-boundary",
      severity: "error",
      from: { path: "^packages/ui/src/", pathNot: testFiles },
      to: {
        path: "^packages/(?:server|contracts)/|(?:^|/)node_modules/(?:next|next-auth|postgres|drizzle-orm)(?:/|$)",
      },
    },
    {
      name: "server-framework",
      severity: "error",
      from: { path: "^packages/server/src/", pathNot: testFiles },
      to: { path: "(?:^|/)node_modules/(?:react|react-dom|next|next-auth|@sentry/nextjs)(?:/|$)" },
    },
    {
      name: "runtime-circular",
      severity: "error",
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ["type-only"] } },
    },
    {
      name: "type-involved-circular",
      severity: "warn",
      from: {},
      to: { circular: true, via: { dependencyTypes: ["type-only"] } },
    },
    { name: "unresolved", severity: "error", from: {}, to: { couldNotResolve: true } },
  ];
  return {
    baseDir: root,
    ...(tsconfig ? { tsConfig: { fileName: tsconfig } } : {}),
    tsPreCompilationDeps: true,
    validate: true,
    ruleSet: { forbidden },
    exclude: { path: "(^|/)(?:node_modules|\\.next|\\.turbo|coverage)/|next-env\\.d\\.ts$" },
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "node", "default", "react-server"],
    },
  };
}

export function workspaceDependencyErrors(
  owners: WorkspaceDependencyOwner[],
  modules: ICruiseResult["modules"] = [],
  rootDependencies: Record<string, string> = {},
) {
  const errors: string[] = [];
  const byName = new Map(owners.map((owner) => [owner.name, owner]));
  for (const [name, version] of Object.entries(rootDependencies)) {
    if (byName.has(name) || version.startsWith("workspace:"))
      errors.push(`root: 내부 workspace 의존성 ${name} 금지`);
  }
  const ownerOf = (file: string) =>
    owners.find(({ directory }) => file.startsWith(directory + "/"));
  for (const owner of owners) {
    for (const [name, version] of Object.entries(owner.dependencies)) {
      const target = byName.get(name);
      if (!target) continue;
      if (target.directory.startsWith("apps/"))
        errors.push(`${owner.directory}: 앱 의존성 ${name} 금지`);
      if (!version.startsWith("workspace:"))
        errors.push(`${owner.directory}: ${name}에 workspace: 필요`);
    }
  }
  for (const module of modules) {
    const from = ownerOf(module.source);
    for (const dependency of module.dependencies) {
      if (dependency.coreModule || dependency.resolved.startsWith("node_modules/")) continue;
      const to = ownerOf(dependency.resolved);
      if (!from) {
        if (to?.directory === "tools/repository") {
          const entry = to.exports?.[rootToolEntries[module.source] ?? ""];
          if (
            !dependency.module.startsWith(".") ||
            !entry ||
            dependency.resolved !== to.directory + "/" + entry.slice(2)
          )
            errors.push(`${module.source}: 등록된 공개 tooling 진입점만 참조해야 함`);
        } else if (to) {
          errors.push(`${module.source}: 내부 package 소비는 tooling workspace가 소유해야 함`);
        }
        continue;
      }
      if (from === to) continue;
      if (
        module.source === "tools/repository/tests/integration/m7-foundation.postgres.test.ts" &&
        dependency.resolved === "apps/web/src/server/http/api-response.ts"
      )
        continue;
      if (
        !to ||
        !(dependency.module === to.name || dependency.module.startsWith(to.name + "/")) ||
        !(to.name in from.dependencies)
      ) {
        errors.push(`${module.source}: 공개 package 의존성으로 참조해야 함: ${dependency.module}`);
      }
    }
  }
  return errors;
}
