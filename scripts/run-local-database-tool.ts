import { spawnSync } from "node:child_process";
import { devNull } from "node:os";
import { fileURLToPath } from "node:url";

import { loadLocalDatabaseUrl } from "./local-database-environment";

const root = fileURLToPath(new URL("../", import.meta.url));

function main() {
  const [tool, ...args] = process.argv.slice(2);
  if (!tool || !["generate", "migrate", "pull", "studio"].includes(tool)) {
    throw new Error("Expected a supported local database tool.");
  }
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (name === "DOTENV_KEY" || name.startsWith("DOTENV_CONFIG_")) delete environment[name];
  }
  // Drizzle Kit embeds dotenv/config; it must not load a second input after our guard.
  environment.DOTENV_CONFIG_PATH = devNull;
  if (tool === "generate") delete environment.DATABASE_URL;
  else {
    const databaseArgs = [...args];
    if (tool === "migrate" && databaseArgs.includes("--legacy-schema"))
      databaseArgs.splice(databaseArgs.indexOf("--legacy-schema"), 1);
    const mapIndex = databaseArgs.indexOf("--uuid-map");
    if (tool === "migrate" && mapIndex !== -1) {
      const file = databaseArgs[mapIndex + 1];
      if (!file || file.startsWith("--")) throw new Error("--uuid-map requires a JSON file");
      databaseArgs.splice(mapIndex, 2);
    }
    environment.DATABASE_URL = loadLocalDatabaseUrl(databaseArgs);
    console.log(`Local database guard passed: ${new URL(environment.DATABASE_URL).hostname}`);
  }
  const command =
    tool === "migrate"
      ? [
          "exec",
          "tsx",
          "scripts/run-drizzle-migrations.ts",
          ...(args.includes("--legacy-schema") ? ["--legacy-schema"] : []),
          ...(args.includes("--uuid-map")
            ? ["--uuid-map", args[args.indexOf("--uuid-map") + 1]!]
            : []),
        ]
      : ["exec", "drizzle-kit", tool, ...(tool === "generate" ? args : [])];
  const result = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", command, {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw new Error("Could not start the local database tool.");
  process.exitCode = result.status ?? 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Local database tool failed.");
  process.exitCode = 1;
}
