import { fileURLToPath } from "node:url";
import { build } from "esbuild";
await build({
  entryPoints: [fileURLToPath(new URL("../worker/firebase-messaging.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("../public/notification-worker.js", import.meta.url)),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "none",
});
