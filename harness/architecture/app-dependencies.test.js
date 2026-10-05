import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

function readAppManifests(root = process.cwd()) {
  const appsDirectory = path.join(root, "apps");

  return fs
    .readdirSync(appsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(appsDirectory, entry.name, "package.json");

      if (!fs.existsSync(manifestPath)) return null;

      return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    })
    .filter(Boolean);
}

test("app workspaces do not depend directly on other app workspaces", () => {
  const manifests = readAppManifests();
  const appNames = new Set(manifests.map((manifest) => manifest.name).filter(Boolean));

  for (const manifest of manifests) {
    for (const field of dependencyFields) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        assert.equal(
          appNames.has(dependency),
          false,
          `${manifest.name} must not depend directly on app workspace ${dependency}`,
        );
      }
    }
  }
});
