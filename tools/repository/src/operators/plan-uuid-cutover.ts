import { readFileSync, writeFileSync } from "node:fs";

import { createEntityId } from "@oioi-bwg/server/db/entity-id";
import { createUuidCutoverMap, validateUuidCutoverMap } from "./uuid-cutover-map";

// Offline JSON input only: never opens a database or applies SQL.
const [mode, sourceFile, mappingFile, ...extra] = process.argv.slice(2);
try {
  if (
    !sourceFile ||
    !mappingFile ||
    !["create", "verify"].includes(mode ?? "") ||
    (mode === "verify" && extra.length)
  )
    throw new Error();
  const resetAdminOldIds: string[] = [];
  for (let index = 0; index < extra.length; index += 2) {
    if (extra[index] !== "--reset-admin-old-id" || !extra[index + 1]) throw new Error();
    resetAdminOldIds.push(extra[index + 1]!);
  }
  const source: unknown = JSON.parse(readFileSync(sourceFile, "utf8"));
  const mapping =
    mode === "create"
      ? createUuidCutoverMap(source, createEntityId, resetAdminOldIds)
      : validateUuidCutoverMap(source, JSON.parse(readFileSync(mappingFile, "utf8")) as unknown);
  if (mode === "create")
    writeFileSync(mappingFile, JSON.stringify(mapping, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
  console.log(
    JSON.stringify({
      success: true,
      mode,
      albums: mapping.albums.length,
      songs: mapping.songs.length,
      accounts: mapping.accounts.length,
      identityFingerprint: mapping.identityFingerprint,
    }),
  );
} catch {
  console.error(JSON.stringify({ success: false, code: "UUID_CUTOVER_PLAN_REJECTED" }));
  process.exitCode = 1;
}
