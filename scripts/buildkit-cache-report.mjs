import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Read the native OCI layout without changing its app tags or cache data. */
export function inspectBuildkitCache(directory) {
  const index = JSON.parse(fs.readFileSync(path.join(directory, "index.json"), "utf8"));
  assert.equal(index.schemaVersion, 2);
  const blobs = new Map();
  const apps = {};
  const references = new Map();

  function visit(descriptor, visited) {
    assert.match(descriptor.digest, /^sha256:[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(descriptor.size) && descriptor.size >= 0);
    if (visited.has(descriptor.digest)) return;
    visited.add(descriptor.digest);
    let blob = blobs.get(descriptor.digest);
    if (!blob) {
      const filename = path.join(directory, "blobs/sha256", descriptor.digest.slice(7));
      const data = fs.readFileSync(filename);
      assert.equal(createHash("sha256").update(data).digest("hex"), descriptor.digest.slice(7));
      const children = [];
      if (descriptor.mediaType === "application/vnd.oci.image.manifest.v1+json") {
        const manifest = JSON.parse(data.toString());
        children.push(manifest.config, ...manifest.layers);
      } else if (descriptor.mediaType === "application/vnd.oci.image.index.v1+json") {
        children.push(...JSON.parse(data.toString()).manifests);
      }
      blob = { size: data.length, mediaType: descriptor.mediaType, children };
      blobs.set(descriptor.digest, blob);
    }
    assert.equal(blob.size, descriptor.size);
    assert.equal(blob.mediaType, descriptor.mediaType);
    for (const child of blob.children) visit(child, visited);
  }

  for (const app of ["web", "console"]) {
    const manifests = index.manifests.filter(
      (entry) => entry.annotations?.["org.opencontainers.image.ref.name"] === app,
    );
    assert.equal(manifests.length, 1, `Expected one cache manifest for ${app}`);
    const visited = new Set();
    visit(manifests[0], visited);
    references.set(app, visited);
    apps[app] = {
      digest: manifests[0].digest,
      bytes: [...visited].reduce((sum, digest) => sum + blobs.get(digest).size, 0),
    };
  }
  assert.notEqual(apps.web.digest, apps.console.digest, "App cache manifests must stay distinct");
  const shared = [...references.get("web")].filter((digest) =>
    references.get("console").has(digest),
  );
  const referencedBytes = [...blobs.values()].reduce((sum, blob) => sum + blob.size, 0);
  const storedBytes = fs.readdirSync(path.join(directory, "blobs/sha256")).reduce((sum, name) => {
    assert.match(name, /^[a-f0-9]{64}$/);
    return sum + fs.statSync(path.join(directory, "blobs/sha256", name)).size;
  }, 0);
  return {
    apps,
    referencedBytes,
    storedBytes,
    separateStoreBytes: apps.web.bytes + apps.console.bytes,
    sharedBlobBytes: shared.reduce((sum, digest) => sum + blobs.get(digest).size, 0),
    unreferencedBytes: storedBytes - referencedBytes,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(inspectBuildkitCache(process.argv[2]), null, 2));
