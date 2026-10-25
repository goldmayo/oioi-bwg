import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { inspectBuildkitCache } from "../../scripts/buildkit-cache-report.mjs";

const roots: string[] = [];
afterEach(() =>
  roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })),
);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "buildkit-cache-report-"));
  roots.push(root);
  const directory = path.join(root, "blobs/sha256");
  fs.mkdirSync(directory, { recursive: true });
  function blob(content: string, mediaType: string) {
    const digest = createHash("sha256").update(content).digest("hex");
    fs.writeFileSync(path.join(directory, digest), content);
    return { digest: `sha256:${digest}`, size: Buffer.byteLength(content), mediaType };
  }
  const layerType = "application/vnd.oci.image.layer.v1.tar+zstd";
  const common = blob("common layer bytes", layerType);
  const config = blob('{"layers":[]}', "application/vnd.buildkit.cacheconfig.v0");
  const manifests = ["web", "console"].map((app) => ({
    ...blob(
      JSON.stringify({
        schemaVersion: 2,
        config,
        layers: [common, blob(app + " layer bytes", layerType)],
      }),
      "application/vnd.oci.image.manifest.v1+json",
    ),
    annotations: { "org.opencontainers.image.ref.name": app },
  }));
  const index = { schemaVersion: 2, manifests };
  const save = () => fs.writeFileSync(path.join(root, "index.json"), JSON.stringify(index));
  save();
  return { root, directory, common, config, index, save };
}

it("keeps app manifests distinct and counts shared blobs once in native storage", () => {
  const f = fixture();
  const result = inspectBuildkitCache(f.root);
  expect(result.sharedBlobBytes).toBe(f.common.size + f.config.size);
  expect(result.separateStoreBytes - result.storedBytes).toBe(result.sharedBlobBytes);
  expect(result.referencedBytes).toBe(result.storedBytes);
  expect(result.unreferencedBytes).toBe(0);
});

it("rejects missing or ambiguous app tags instead of accepting a single overwritten manifest", () => {
  const f = fixture();
  f.index.manifests.pop();
  f.save();
  expect(() => inspectBuildkitCache(f.root)).toThrow("Expected one cache manifest for console");
  f.index.manifests.push(f.index.manifests[0]);
  f.save();
  expect(() => inspectBuildkitCache(f.root)).toThrow("Expected one cache manifest for web");
});

it("rejects corrupt, missing and incorrectly sized referenced blobs", () => {
  const f = fixture();
  const filename = path.join(f.directory, f.common.digest.slice(7));
  fs.writeFileSync(filename, "corrupt bytes");
  expect(() => inspectBuildkitCache(f.root)).toThrow();
  fs.rmSync(filename);
  expect(() => inspectBuildkitCache(f.root)).toThrow();
  fs.writeFileSync(filename, "common layer bytes");
  f.index.manifests[0].size++;
  f.save();
  expect(() => inspectBuildkitCache(f.root)).toThrow();
});
