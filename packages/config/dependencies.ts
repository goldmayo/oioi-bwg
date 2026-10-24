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
          "^tests/integration/m7-foundation\\.postgres\\.test\\.ts$",
        ],
      },
      to: { path: "^apps/" },
    },
    {
      name: "foundation-app-adapter",
      severity: "error",
      from: { path: "^tests/integration/m7-foundation\\.postgres\\.test\\.ts$" },
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
          "^(?:apps/[^/]+|packages/(?:server|contracts))/src/",
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
) {
  const errors: string[] = [];
  const byName = new Map(owners.map((owner) => [owner.name, owner]));
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
          if (!entry || dependency.resolved !== to.directory + "/" + entry.slice(2))
            errors.push(`${module.source}: 등록된 공개 tooling 진입점만 참조해야 함`);
        }
        continue;
      }
      if (from === to) continue;
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
