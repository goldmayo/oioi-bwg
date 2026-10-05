import assert from "node:assert/strict";
import test from "node:test";

import { getSourceParts, resolveImportedParts } from "./import-path.js";

test("extracts source-relative parts from repository paths", () => {
  assert.deepEqual(getSourceParts("/repo/apps/web/src/features/auth/ui/form.tsx"), [
    "features",
    "auth",
    "ui",
    "form.tsx",
  ]);
  assert.equal(getSourceParts("/repo/apps/web/types/global.d.ts"), null);
});

test("resolves aliases and relative imports without workspace knowledge", () => {
  const source = ["features", "auth", "ui", "form.tsx"];

  assert.deepEqual(resolveImportedParts(source, "@/shared/lib/date"), ["shared", "lib", "date"]);
  assert.deepEqual(resolveImportedParts(source, "../model/use-auth"), [
    "features",
    "auth",
    "model",
    "use-auth",
  ]);
  assert.equal(resolveImportedParts(source, "react"), null);
});
