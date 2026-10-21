import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { build } from "esbuild";

const directory = path.resolve(".local/console-operator");
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const output = await build({
  entryPoints: ["scripts/console-mfa-oci-worker.ts"],
  bundle: true,
  write: false,
  platform: "node",
  target: "node22",
  format: "cjs",
  conditions: ["react-server"],
  metafile: true,
});
const code = output.outputFiles[0].contents;
fs.writeFileSync(path.join(directory, "console-operator.cjs"), code, { mode: 0o600 });
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const inputs = Object.fromEntries(
  Object.keys(output.metafile.inputs)
    .filter((file) => !file.includes("node_modules/"))
    .map((file) => [file, sha256(fs.readFileSync(file))]),
);
fs.writeFileSync(
  path.join(directory, "provenance.json"),
  JSON.stringify({ bundleSha256: sha256(code), sourceHashes: inputs }, null, 2),
  { mode: 0o600 },
);
console.log("Console operator bundle prepared; no host installation or mutation.");
