import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const verificationJobNames = {
  infra: "infra",
  quality: "quality",
  unit: "unit",
  waveform: "waveform ARM64",
  postgres_integration: "PostgreSQL integration",
  app_build: "app build",
  build: "build",
};
export const verificationJobs = Object.keys(verificationJobNames);

export function verificationMode({
  eventName,
  event,
  markdownOnlyChange = false,
  historyOnlyChange = false,
  impactOnlyChange = false,
}) {
  if (markdownOnlyChange) return "docs";
  if (eventName === "pull_request") {
    if (event?.pull_request?.base?.ref === "production") return "promotion";
    if (event?.pull_request?.base?.ref === "main" && event.pull_request.draft === true)
      return "partial";
    if (event?.pull_request?.base?.ref === "main" && historyOnlyChange) return "history";
    if (
      event?.pull_request?.base?.ref === "main" &&
      event.pull_request.draft === false &&
      impactOnlyChange
    )
      return "impact";
  }
  return "full";
}

/** 파일 tree가 같고 현재 main을 첫 부모로 연결한 merge만 별도 근거 검증으로 보낸다. */
/** @param {{ eventName?: string, event?: { pull_request?: { base?: { ref?: string, sha?: string }, head?: { sha?: string } } }, cwd?: string }} [options] */
export function historyOnly({ eventName, event, cwd = process.cwd() } = {}) {
  const pr = event?.pull_request;
  if (eventName !== "pull_request" || pr?.base?.ref !== "main") return false;
  const { sha: head } = pr.head ?? {};
  const { sha: base } = pr.base ?? {};
  if (![head, base].every((value) => /^[0-9a-f]{40}$/.test(value ?? ""))) return false;
  try {
    const git = (...args) =>
      execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10_000,
      }).trim();
    const parents = git("show", "-s", "--format=%P", head).split(" ");
    return (
      parents.length === 2 &&
      parents[0] === base &&
      git("rev-parse", `${head}^{tree}`) === git("rev-parse", `${base}^{tree}`)
    );
  } catch {
    return false;
  }
}

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

/** @param {{ eventName?: string, event?: { pull_request?: { base?: { ref?: string, sha?: string }, head?: { sha?: string } } }, local?: boolean, fetchSource?: boolean, cwd?: string, matches?: (raw: string) => boolean }} [options] */
function changesMatch({
  eventName,
  event,
  local = false,
  fetchSource = false,
  cwd = process.cwd(),
  matches = markdownOnly,
} = {}) {
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
      base = "origin/main";
      head = "HEAD";
    } else {
      if (
        eventName !== "pull_request" ||
        !(
          event?.pull_request?.base?.ref === "main" ||
          (fetchSource && event?.pull_request?.base?.ref === "migration_main")
        )
      )
        return false;
      base = event.pull_request.base.sha;
      head = event.pull_request.head.sha;
      if (![base, head].every((sha) => /^[0-9a-f]{40}$/.test(sha))) return false;
      // Squash 뒤 원격 작업 브랜치가 삭제돼도 원래 PR의 Git 이력을 정확히 판정한다.
      if (fetchSource) git("fetch", "--no-tags", "origin", base, head);
    }
    const ancestor = git("merge-base", base, head).trim();
    return matches(
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

/** @param {Parameters<typeof changesMatch>[0]} [options] */
export function docsOnly(options = {}) {
  return changesMatch(options);
}

export function uiOnly(raw) {
  const fields = raw.split("\0");
  if (fields.pop() !== "" || !fields.length || fields.length % 2) return false;
  let ui = false;
  for (let i = 0; i < fields.length; i += 2) {
    if (!/^:(000000|100644) (000000|100644) [0-9a-f]{40,64} [0-9a-f]{40,64} [AMD]$/.test(fields[i]))
      return false;
    const file = fields[i + 1];
    if (file.endsWith(".md")) continue;
    if (/(?:^|\/)(?:auth|admin-login|login|mfa|security|api|server)(?:[./-]|$)/i.test(file))
      return false;
    const selected =
      /^apps\/(web|console)\/(?:src\/.*\.css|src\/(?:shared\/ui\/|.*\/_ui\/).*\.(?:tsx|test\.ts)|public\/.*\.(?:png|jpe?g|webp|gif|ico|woff2?))$/.test(
        file,
      );
    if (!selected) return false;
    ui = true;
  }
  return ui;
}

/** @param {Parameters<typeof changesMatch>[0]} [options] */
export function impactOnly(options = {}) {
  return changesMatch({ ...options, matches: uiOnly });
}

export function verificationPassed(needs) {
  const scope = needs.changes;
  if (scope?.result !== "success" || !["true", "false"].includes(scope.outputs?.docs_only))
    return false;
  const mode = scope.outputs.mode;
  if (!["full", "partial", "impact", "promotion", "history", "docs"].includes(mode)) return false;
  if ((mode === "docs") !== (scope.outputs.docs_only === "true")) return false;
  const expected = mode === "full" ? "success" : "skipped";
  return (
    verificationJobs.every(
      (name) =>
        needs[name]?.result ===
        (mode === "impact" && ["app_build", "build"].includes(name) ? "success" : expected),
    ) &&
    needs.partial?.result === (["partial", "impact"].includes(mode) ? "success" : "skipped") &&
    needs.source_verification?.result ===
      (["promotion", "history"].includes(mode) ? "success" : "skipped")
  );
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
    const markdownOnlyChange = docsOnly({
      eventName: process.env.GITHUB_EVENT_NAME,
      event,
      local: process.argv[2] === "--local",
    });
    console.log(`docs_only=${markdownOnlyChange}`);
    if (process.argv[2] !== "--local")
      console.log(
        `mode=${verificationMode({ eventName: process.env.GITHUB_EVENT_NAME, event, markdownOnlyChange, impactOnlyChange: impactOnly({ eventName: process.env.GITHUB_EVENT_NAME, event }), historyOnlyChange: historyOnly({ eventName: process.env.GITHUB_EVENT_NAME, event }) })}`,
      );
  }
}
