import assert from "node:assert/strict";
import test from "node:test";

import {
  getSourceParts,
  relativeImportEscapesSource,
  resolveImportedParts,
} from "./import-path.js";

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

test("detects relative imports that escape a workspace source root", () => {
  const source = ["app", "admin", "page.tsx"];

  assert.equal(relativeImportEscapesSource(source, "../../shared/lib/date"), false);
  assert.equal(relativeImportEscapesSource(source, "../../../package.json"), true);
  assert.equal(relativeImportEscapesSource(source, "@/shared/lib/date"), false);
});
