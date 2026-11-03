import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { RuleTester } from "oxlint/plugins-dev";

import { architectureRule } from "@oioi-bwg/config/oxlint/architecture-rule";

RuleTester.describe = describe;
RuleTester.it = test;
const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "js" } } });
const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
let caseNumber = 0;

function check(relativeFilename, code, expected) {
  const item = {
    name: relativeFilename + " #" + ++caseNumber,
    filename: path.join(repositoryRoot, relativeFilename),
    code,
  };
  ruleTester.run(
    "architecture",
    architectureRule,
    expected.length
      ? {
          valid: [],
          invalid: [{ ...item, errors: expected.map((messageId) => ({ messageId })) }],
        }
      : { valid: [item], invalid: [] },
  );
}

test("keeps typed lint and alias boundaries from repository and app roots", () => {
  for (const app of ["web", "console"]) {
    const appRoot = path.join(repositoryRoot, "apps", app);
    const filename = path.join(
      appRoot,
      `src/shared/config/native-policy-regression-${process.pid}.ts`,
    );
    const source = [
      'import { toErrorResponse } from "@/server/http/api-response";',
      'export { AppError } from "@oioi-bwg/server/errors/app-error";',
      `export { default as foreignPage } from "../../../../${app === "web" ? "console" : "web"}/src/app/page";`,
      "export const response = toErrorResponse;",
      "Promise.resolve();",
    ].join("\n");
    fs.writeFileSync(filename, source, { flag: "wx" });
    try {
      for (const cwd of [repositoryRoot, appRoot]) {
        const result = spawnSync(
          process.execPath,
          [
            path.join(repositoryRoot, "node_modules/oxlint/bin/oxlint"),
            "--type-aware",
            "--report-unused-disable-directives-severity",
            "warn",
            "--format=json",
            filename,
          ],
          { cwd, encoding: "utf8" },
        );
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, result.stderr || result.stdout);
        const { diagnostics } = JSON.parse(result.stdout);
        const codes = diagnostics.map(({ code }) => code);
        for (const code of [
          "typescript(no-floating-promises)",
          "boundaries(dependencies)",
          "project(architecture)",
        ])
          assert.ok(codes.includes(code), result.stdout);
        assert.ok(
          diagnostics.some(({ message }) => message.includes("다른 앱을 직접 import하지")),
          result.stdout,
        );
      }
    } finally {
      fs.unlinkSync(filename);
    }
  }
});

describe("rejects files outside the constitutional src layers", () => {
  check("apps/web/src/containers/card.js", "export {};", ["unknownLayer"]);
});

describe("rejects shared server package imports in client layers", () => {
  for (const layer of [
    "widgets/card/model",
    "features/auth/model",
    "entities/song/model",
    "shared/config",
  ]) {
    for (const source of [
      'export { getDatabase } from "@oioi-bwg/server/db";',
      'import("@oioi-bwg/server/services/song-service");',
    ]) {
      check(`apps/web/src/${layer}/probe.js`, source, ["clientServerPackage"]);
    }
  }
  check(
    "apps/web/src/app/page.js",
    'import { listSongs } from "@oioi-bwg/server/services/song-service";',
    [],
  );
  check(
    "apps/web/src/app/(user)/_ui/probe.js",
    '"use client"; export { AppError } from "@oioi-bwg/server/errors/app-error";',
    ["clientServerPackage"],
  );
});

describe("rejects invalid promoted slice placement", () => {
  check("apps/web/src/features/auth/form.js", "export {};", ["invalidSliceRoot"]);
  check("apps/web/src/features/auth/components/form.js", "export {};", ["invalidSliceSegment"]);
  check("apps/web/src/features/auth/ui/use-auth.js", "export {};", ["invalidHookSegment"]);
});

describe("rejects invalid route-private and shared segments", () => {
  check("apps/web/src/app/(user)/_components/card.js", "export {};", ["invalidRouteSegment"]);
  check("apps/web/src/app/(user)/_ui/use-card.js", "export {};", ["invalidRouteHookSegment"]);
  check("apps/web/src/shared/utils/date.js", "export {};", ["invalidSharedSegment"]);
  check("apps/web/src/shared/contracts/song.js", "export {};", []);
});

describe("enforces promoted slice public APIs", () => {
  check("apps/web/src/app/page.js", 'import { songQueryKeys } from "@/entities/song";', []);
  check("apps/web/src/app/page.js", 'import x from "@/features/auth/ui/form";', [
    "deepSliceImport",
  ]);
  check("apps/web/src/app/page.js", 'import x from "@/entities/song/api/queries";', [
    "deepSliceImport",
  ]);
  check("apps/web/src/app/page.js", 'export { x } from "@/features/auth/ui/form";', [
    "deepSliceImport",
  ]);
  check("apps/web/src/app/page.js", 'import("@/features/auth/ui/form");', ["deepSliceImport"]);
});

describe("allows entity API entries while rejecting internal paths in both apps", () => {
  for (const app of ["web", "console"]) {
    for (const entry of ["@/entities/song", "../entities/song"]) {
      for (const statement of [
        (source) => `import { songQueries } from "${source}";`,
        (source) => `export { songQueries } from "${source}";`,
        (source) => `export * from "${source}";`,
        (source) => `import("${source}");`,
      ]) {
        check(`apps/${app}/src/app/page.js`, statement(`${entry}/api`), []);
        for (const internal of ["api/queries", "api/mutations", "api/index", "model/song"]) {
          check(`apps/${app}/src/app/page.js`, statement(`${entry}/${internal}`), [
            "deepSliceImport",
          ]);
        }
      }
    }
    for (const layer of ["features", "widgets"]) {
      check(`apps/${app}/src/app/page.js`, `import x from "@/${layer}/example/api";`, [
        "deepSliceImport",
      ]);
    }
  }
});

describe("blocks same-layer cross-slice imports through aliases and relative paths", () => {
  check("apps/web/src/features/alpha/ui/a.js", 'import x from "@/features/beta";', [
    "crossSliceImport",
  ]);
  check("apps/web/src/features/alpha/ui/a.js", 'import x from "../../beta";', ["crossSliceImport"]);
  for (const app of ["web", "console"]) {
    for (const entry of ["@/entities/song", "../../song"]) {
      check(`apps/${app}/src/entities/album/model/a.js`, `import x from "${entry}/api";`, [
        "crossSliceImport",
      ]);
      check(`apps/${app}/src/entities/album/model/a.js`, `import x from "${entry}/api/queries";`, [
        "crossSliceImport",
        "deepSliceImport",
      ]);
    }
  }
});

describe("requires relative imports inside one slice", () => {
  check("apps/web/src/features/alpha/ui/a.js", 'import x from "@/features/alpha";', [
    "sameSliceAlias",
  ]);
  check("apps/web/src/features/alpha/ui/a.js", 'import x from "../model/x";', []);
});

describe("keeps route-private imports inside their owning route", () => {
  check("apps/web/src/app/admin/page.js", 'import x from "../(user)/_ui/x";', [
    "foreignRoutePrivateImport",
  ]);
  check("apps/web/src/app/(user)/page.js", 'import x from "@/app/(user)/_ui/x";', [
    "routePrivateAlias",
  ]);
  check("apps/web/src/app/(user)/page.js", 'import x from "./_ui/x";', []);
});

describe("keeps database-specific dependencies below the Service boundary", () => {
  check(
    "apps/web/src/server/services/song-service.js",
    [
      'import { eq } from "drizzle-orm";',
      'import postgres from "postgres";',
      'import { isPostgresUniqueViolation } from "../db/postgres-error";',
    ].join("\n"),
    [
      "servicePersistenceDependency",
      "servicePersistenceDependency",
      "servicePersistenceDependency",
    ],
  );
  check(
    "apps/web/src/server/services/song-service.js",
    'import { SongSlugConflictError } from "../repositories/repository-error";',
    [],
  );
  check(
    "apps/web/src/server/repositories/song-repository.js",
    'import { isPostgresUniqueViolation } from "../db/postgres-error";',
    [],
  );
});

describe("rejects relative, package and dynamic imports between apps", () => {
  for (const app of ["web", "console"]) {
    const other = app === "web" ? "console" : "web";
    for (const source of [
      `export { default } from "../../../${other}/src/app/page";`,
      `import("@oioi-bwg/${other}");`,
    ]) {
      check(`apps/${app}/src/app/probe.js`, source, ["crossAppImport"]);
    }
  }
});

describe("keeps tooling config outside both app runtime graphs", () => {
  for (const app of ["web", "console"]) {
    for (const layer of ["app", "shared", "server"]) {
      for (const source of [
        'export * from "@oioi-bwg/config/next";',
        'import("@oioi-bwg/config/eslint/app");',
      ]) {
        const segment = layer === "shared" ? "shared/config" : layer;
        check(`apps/${app}/src/${segment}/probe.js`, source, ["toolingConfigPackage"]);
      }
    }
  }
});
