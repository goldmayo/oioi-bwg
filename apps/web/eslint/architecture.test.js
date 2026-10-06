import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { Linter } from "eslint";

import { architectureRule } from "./architecture.js";

const linter = new Linter({ configType: "flat" });
const config = [
  {
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    plugins: { project: { rules: { architecture: architectureRule } } },
    rules: { "project/architecture": "error" },
  },
];

function lint(relativeFilename, code = "export {};") {
  const filename = `${process.cwd()}/${relativeFilename}`;

  return linter.verify(code, config, filename).map(({ messageId }) => messageId);
}

test("keeps typed lint and alias dependency boundaries from both repository and app roots", () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  for (const app of ["web", "console"]) {
    const webRoot = path.join(repositoryRoot, "apps", app);
    const filename = path.join(
      webRoot,
      `src/shared/config/eslint-policy-regression-${process.pid}.ts`,
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
      for (const cwd of [repositoryRoot, webRoot]) {
        const result = spawnSync(
          process.execPath,
          [
            path.join(repositoryRoot, "node_modules/eslint/bin/eslint.js"),
            filename,
            "--format=json",
          ],
          { cwd, encoding: "utf8" },
        );

        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, result.stderr || result.stdout);
        const [{ messages }] = JSON.parse(result.stdout);
        const rules = messages.map(({ ruleId }) => ruleId);
        assert.ok(rules.includes("@typescript-eslint/no-floating-promises"), result.stdout);
        assert.ok(rules.includes("boundaries/dependencies"), result.stdout);
        assert.ok(rules.includes("project/architecture"), result.stdout);
        assert.ok(
          messages.some(({ messageId }) => messageId === "crossAppImport"),
          result.stdout,
        );
        assert.ok(!rules.includes(null), result.stdout);
      }
    } finally {
      fs.unlinkSync(filename);
    }
  }
});

test("rejects files outside the constitutional src layers", () => {
  assert.deepEqual(lint("apps/web/src/containers/card.js"), ["unknownLayer"]);
});

test("rejects shared server package imports in client layers", () => {
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
      assert.deepEqual(lint(`apps/web/src/${layer}/probe.js`, source), ["clientServerPackage"]);
    }
  }
  assert.deepEqual(
    lint(
      "apps/web/src/app/page.js",
      'import { listSongs } from "@oioi-bwg/server/services/song-service";',
    ),
    [],
  );
  assert.deepEqual(
    lint(
      "apps/web/src/app/(user)/_ui/probe.js",
      '"use client"; export { AppError } from "@oioi-bwg/server/errors/app-error";',
    ),
    ["clientServerPackage"],
  );
});

test("rejects invalid promoted slice placement", () => {
  assert.deepEqual(lint("apps/web/src/features/auth/form.js"), ["invalidSliceRoot"]);
  assert.deepEqual(lint("apps/web/src/features/auth/components/form.js"), ["invalidSliceSegment"]);
  assert.deepEqual(lint("apps/web/src/features/auth/ui/use-auth.js"), ["invalidHookSegment"]);
});

test("rejects invalid route-private and shared segments", () => {
  assert.deepEqual(lint("apps/web/src/app/(user)/_components/card.js"), ["invalidRouteSegment"]);
  assert.deepEqual(lint("apps/web/src/app/(user)/_ui/use-card.js"), ["invalidRouteHookSegment"]);
  assert.deepEqual(lint("apps/web/src/shared/utils/date.js"), ["invalidSharedSegment"]);
  assert.deepEqual(lint("apps/web/src/shared/contracts/song.js"), []);
});

test("enforces promoted slice public APIs", () => {
  assert.deepEqual(
    lint("apps/web/src/app/page.js", 'import { songQueries } from "@/entities/song/api";'),
    ["deepSliceImport"],
  );
  assert.deepEqual(
    lint("apps/web/src/app/page.js", 'import { songQueries } from "@/entities/song";'),
    [],
  );
  assert.deepEqual(lint("apps/web/src/app/page.js", 'import x from "@/features/auth/ui/form";'), [
    "deepSliceImport",
  ]);
  assert.deepEqual(
    lint("apps/web/src/app/page.js", 'import x from "@/entities/song/api/queries";'),
    ["deepSliceImport"],
  );
  assert.deepEqual(
    lint("apps/web/src/app/page.js", 'export { x } from "@/features/auth/ui/form";'),
    ["deepSliceImport"],
  );
  assert.deepEqual(lint("apps/web/src/app/page.js", 'import("@/features/auth/ui/form");'), [
    "deepSliceImport",
  ]);
});

test("blocks same-layer cross-slice imports through aliases and relative paths", () => {
  assert.deepEqual(
    lint("apps/web/src/features/alpha/ui/a.js", 'import x from "@/features/beta";'),
    ["crossSliceImport"],
  );
  assert.deepEqual(lint("apps/web/src/features/alpha/ui/a.js", 'import x from "../../beta";'), [
    "crossSliceImport",
  ]);
});

test("requires relative imports inside one slice", () => {
  assert.deepEqual(
    lint("apps/web/src/features/alpha/ui/a.js", 'import x from "@/features/alpha";'),
    ["sameSliceAlias"],
  );
  assert.deepEqual(lint("apps/web/src/features/alpha/ui/a.js", 'import x from "../model/x";'), []);
});

test("keeps route-private imports inside their owning route", () => {
  assert.deepEqual(lint("apps/web/src/app/admin/page.js", 'import x from "../(user)/_ui/x";'), [
    "foreignRoutePrivateImport",
  ]);
  assert.deepEqual(lint("apps/web/src/app/(user)/page.js", 'import x from "@/app/(user)/_ui/x";'), [
    "routePrivateAlias",
  ]);
  assert.deepEqual(lint("apps/web/src/app/(user)/page.js", 'import x from "./_ui/x";'), []);
});

test("keeps database-specific dependencies below the Service boundary", () => {
  assert.deepEqual(
    lint(
      "apps/web/src/server/services/song-service.js",
      [
        'import { eq } from "drizzle-orm";',
        'import postgres from "postgres";',
        'import { isPostgresUniqueViolation } from "../db/postgres-error";',
      ].join("\n"),
    ),
    [
      "servicePersistenceDependency",
      "servicePersistenceDependency",
      "servicePersistenceDependency",
    ],
  );
  assert.deepEqual(
    lint(
      "apps/web/src/server/services/song-service.js",
      'import { SongSlugConflictError } from "../repositories/repository-error";',
    ),
    [],
  );
  assert.deepEqual(
    lint(
      "apps/web/src/server/repositories/song-repository.js",
      'import { isPostgresUniqueViolation } from "../db/postgres-error";',
    ),
    [],
  );
});

test("rejects relative, package and dynamic imports between apps", () => {
  for (const app of ["web", "console"]) {
    const other = app === "web" ? "console" : "web";
    for (const source of [
      `export { default } from "../../../${other}/src/app/page";`,
      `import("@oioi-bwg/${other}");`,
    ]) {
      assert.deepEqual(lint(`apps/${app}/src/app/probe.js`, source), ["crossAppImport"]);
    }
  }
});
