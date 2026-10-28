import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const verificationJobs = [
  "infra",
  "quality",
  "unit",
  "waveform",
  "postgres_integration",
  "app_build",
  "build",
];

export function markdownOnly(raw) {
  const fields = raw.split("\0");
  if (fields.pop() !== "" || fields.length === 0 || fields.length % 2 !== 0) return false;
  for (let i = 0; i < fields.length; i += 2) {
    if (
      !/^:(000000|100644) (000000|100644) [0-9a-f]{40,64} [0-9a-f]{40,64} [AMD]$/.test(fields[i]) ||
      !fields[i + 1].endsWith(".md")
    )
      return false;
  }
  return true;
}

/** @param {{ eventName?: string, event?: { pull_request?: { base?: { ref?: string, sha?: string }, head?: { sha?: string } } }, local?: boolean, cwd?: string }} [options] */
export function docsOnly({ eventName, event, local = false, cwd = process.cwd() } = {}) {
  try {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
    );
    const git = (...args) =>
      execFileSync("git", args, {
        cwd,
        env,
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
    let base, head;
    if (local) {
      const branch = git("branch", "--show-current").trim();
      if (!branch.startsWith("feature/")) return false;
      base = "origin/migration_main";
      head = "HEAD";
    } else {
      if (eventName !== "pull_request" || event?.pull_request?.base?.ref !== "migration_main")
        return false;
      base = event.pull_request.base.sha;
      head = event.pull_request.head.sha;
      if (![base, head].every((sha) => /^[0-9a-f]{40}$/.test(sha))) return false;
    }
    const ancestor = git("merge-base", base, head).trim();
    return markdownOnly(
      git(
        "diff",
        "--raw",
        "--no-abbrev",
        "--no-renames",
        "--no-ext-diff",
        "-z",
        ancestor,
        head,
        "--",
      ),
    );
  } catch {
    return false;
  }
}

export function verificationPassed(needs) {
  const scope = needs.changes;
  if (scope?.result !== "success" || !["true", "false"].includes(scope.outputs?.docs_only))
    return false;
  const expected = scope.outputs.docs_only === "true" ? "skipped" : "success";
  return verificationJobs.every((name) => needs[name]?.result === expected);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--gate") {
    let passed = false;
    try {
      passed = verificationPassed(JSON.parse(process.env.VERIFICATION_NEEDS));
    } catch {
      /* reject missing evidence */
    }
    console.log(
      passed ? "Verification requirements satisfied" : "Verification requirements not satisfied",
    );
    process.exitCode = passed ? 0 : 1;
  } else {
    let event;
    try {
      event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    } catch {
      /* full verification */
    }
    console.log(
      `docs_only=${docsOnly({ eventName: process.env.GITHUB_EVENT_NAME, event, local: process.argv[2] === "--local" })}`,
    );
  }
}
