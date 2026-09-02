import assert from "node:assert/strict";
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

test("rejects files outside the constitutional src layers", () => {
  assert.deepEqual(lint("src/containers/card.js"), ["unknownLayer"]);
});

test("rejects invalid promoted slice placement", () => {
  assert.deepEqual(lint("src/features/auth/form.js"), ["invalidSliceRoot"]);
  assert.deepEqual(lint("src/features/auth/components/form.js"), ["invalidSliceSegment"]);
  assert.deepEqual(lint("src/features/auth/ui/use-auth.js"), ["invalidHookSegment"]);
});

test("rejects invalid route-private and shared segments", () => {
  assert.deepEqual(lint("src/app/(user)/_components/card.js"), ["invalidRouteSegment"]);
  assert.deepEqual(lint("src/app/(user)/_ui/use-card.js"), ["invalidRouteHookSegment"]);
  assert.deepEqual(lint("src/shared/utils/date.js"), ["invalidSharedSegment"]);
  assert.deepEqual(lint("src/shared/contracts/song.js"), []);
});

test("enforces promoted slice public APIs", () => {
  assert.deepEqual(lint("src/app/page.js", 'import { songQueries } from "@/entities/song/api";'), [
    "deepSliceImport",
  ]);
  assert.deepEqual(lint("src/app/page.js", 'import { songQueries } from "@/entities/song";'), []);
  assert.deepEqual(lint("src/app/page.js", 'import x from "@/features/auth/ui/form";'), [
    "deepSliceImport",
  ]);
  assert.deepEqual(lint("src/app/page.js", 'import x from "@/entities/song/api/queries";'), [
    "deepSliceImport",
  ]);
  assert.deepEqual(lint("src/app/page.js", 'export { x } from "@/features/auth/ui/form";'), [
    "deepSliceImport",
  ]);
  assert.deepEqual(lint("src/app/page.js", 'import("@/features/auth/ui/form");'), [
    "deepSliceImport",
  ]);
});

test("blocks same-layer cross-slice imports through aliases and relative paths", () => {
  assert.deepEqual(lint("src/features/alpha/ui/a.js", 'import x from "@/features/beta";'), [
    "crossSliceImport",
  ]);
  assert.deepEqual(lint("src/features/alpha/ui/a.js", 'import x from "../../beta";'), [
    "crossSliceImport",
  ]);
});

test("requires relative imports inside one slice", () => {
  assert.deepEqual(lint("src/features/alpha/ui/a.js", 'import x from "@/features/alpha";'), [
    "sameSliceAlias",
  ]);
  assert.deepEqual(lint("src/features/alpha/ui/a.js", 'import x from "../model/x";'), []);
});

test("keeps route-private imports inside their owning route", () => {
  assert.deepEqual(lint("src/app/admin/page.js", 'import x from "../(user)/_ui/x";'), [
    "foreignRoutePrivateImport",
  ]);
  assert.deepEqual(lint("src/app/(user)/page.js", 'import x from "@/app/(user)/_ui/x";'), [
    "routePrivateAlias",
  ]);
  assert.deepEqual(lint("src/app/(user)/page.js", 'import x from "./_ui/x";'), []);
});
