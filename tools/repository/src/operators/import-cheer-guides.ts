import { readFileSync, writeFileSync } from "node:fs";
import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { getDatabase } from "@oioi-bwg/server/db";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { findAuthorizationFactsByAccountId } from "@oioi-bwg/server/repositories/auth-repository";
import {
  importLegacyGuide,
  legacyGuideImportManifestSchema,
  planLegacyGuideImport,
} from "@oioi-bwg/server/services/cheer-guide-import-service";

export function parseGuideImportArguments(args: readonly string[]) {
  const [mode, manifestFile, ...options] = args;
  if (
    !["plan", "check", "apply"].includes(mode ?? "") ||
    !manifestFile ||
    manifestFile.startsWith("--")
  )
    throw new Error("Invalid guide import arguments");
  let actorId: string | undefined;
  const envArgs: string[] = [];
  for (let index = 0; index < options.length; index += 2) {
    const [flag, value] = options.slice(index, index + 2);
    if (!value || value.startsWith("--")) throw new Error("Missing guide import option");
    if (flag === "--actor" && !actorId) actorId = entityIdSchema.parse(value);
    else if (flag === "--env-file" && !envArgs.length) envArgs.push(flag, value);
    else throw new Error("Unknown or duplicate guide import option");
  }
  if (!actorId) throw new Error("An existing administrator is required");
  return { mode, manifestFile, actorId, envArgs };
}
export async function runGuideImport(request: ReturnType<typeof parseGuideImportArguments>) {
  // The entrypoint sets DATABASE_URL only after the shared local database guard succeeds.
  const database = getDatabase();
  try {
    const actor = await findAuthorizationFactsByAccountId(database, request.actorId);
    if (actor?.role !== "ADMIN" || actor.status !== "ACTIVE") throw new AppError("FORBIDDEN");
    const ctx = {
      user: { id: actor.id },
      ability: buildAbility({ accountId: actor.id, role: actor.role }),
    };
    if (request.mode === "plan") {
      const plan = await planLegacyGuideImport(ctx);
      writeFileSync(request.manifestFile, JSON.stringify(plan, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      return { candidates: plan.entries.length, excluded: plan.excludedSongIds.length };
    }
    const input: unknown = JSON.parse(readFileSync(request.manifestFile, "utf8"));
    const manifest = legacyGuideImportManifestSchema.parse(input);
    const results = [];
    for (const entry of manifest.entries) {
      const result = await importLegacyGuide(ctx, entry, request.mode === "apply");
      results.push(result);
      console.log(JSON.stringify(result));
    }
    return { mode: request.mode, processed: results.length };
  } finally {
    await database.$client.end();
  }
}

export function guideImportFailure(error: unknown) {
  return error instanceof AppError ? error.code : "CHEER_GUIDE_IMPORT_FAILED";
}
