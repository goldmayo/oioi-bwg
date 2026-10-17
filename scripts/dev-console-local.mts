import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const root = fileURLToPath(new URL("../", import.meta.url));
const migrationUrl = "postgresql://oioibawige:oioibawige_dev_only@127.0.0.1:5432/oioibawige";

/** 실행 전에 대상/키를 검사하며 실패 메시지에는 입력 값을 넣지 않는다. */
export function validateLocalConsoleEnvironment(values: Record<string, string>) {
  let database: URL;
  try {
    database = new URL(values.DATABASE_URL ?? "");
  } catch {
    throw new Error("Console .env.local의 DATABASE_URL을 설정해주세요.");
  }
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    database.hostname !== "127.0.0.1" ||
    database.port !== "5432" ||
    database.pathname !== "/oioibawige" ||
    !["oioibawige", "oioi_app"].includes(database.username) ||
    !database.password ||
    database.search ||
    database.hash
  )
    throw new Error("Console 로컬 실행은 Compose의 127.0.0.1:5432/oioibawige만 허용합니다.");
  if (!["http://127.0.0.1:3001", "http://localhost:3001"].includes(values.CONSOLE_ORIGIN ?? ""))
    throw new Error("CONSOLE_ORIGIN은 http://127.0.0.1:3001로 설정해주세요.");
  const secret = values.CONSOLE_AUTH_SECRET ?? "";
  const encoded = values.CONSOLE_MFA_ENCRYPTION_KEY ?? "";
  const key = Buffer.from(encoded, "base64");
  if (
    secret.length < 32 ||
    secret === values.AUTH_SECRET ||
    key.length !== 32 ||
    key.toString("base64") !== encoded ||
    encoded === secret ||
    encoded === values.AUTH_SECRET
  )
    throw new Error("Console 서명/암호화 키를 서로 다른 값으로 설정해주세요. .env.example 참고.");
  if (!["true", "false"].includes(values.CONSOLE_MFA_ENROLLMENT_ENABLED ?? "false"))
    throw new Error("CONSOLE_MFA_ENROLLMENT_ENABLED는 true 또는 false로 설정해주세요.");
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw new Error(`${command} 실행 실패: 설치/실행 상태를 확인해주세요.`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
  let values: Record<string, string>;
  try {
    values = dotenv.parse(readFileSync(new URL("../apps/console/.env.local", import.meta.url)));
  } catch {
    throw new Error("apps/console/.env.example을 참고해 .env.local을 준비해주세요.");
  }
  validateLocalConsoleEnvironment({
    ...values,
    AUTH_SECRET: values.AUTH_SECRET ?? process.env.AUTH_SECRET ?? "",
  });
  const env = { ...process.env, ...values, NEXT_PUBLIC_APP_ENV: "local" };
  console.log("[1/3] Docker Compose PostgreSQL 시작 및 health 확인");
  run("docker", ["compose", "-f", "compose.dev.yml", "up", "-d", "--wait", "postgres"], env);
  console.log("[2/3] 로컬 migration 적용 (기존 데이터/키 보존)");
  run("pnpm", ["db:migrate"], { ...env, DATABASE_URL: migrationUrl });
  console.log(`[3/3] Console 실행: ${values.CONSOLE_ORIGIN}/admin-login (종료: Ctrl+C)`);
  run("pnpm", ["dev:console"], env);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Console 로컬 실행 실패");
    process.exitCode = 1;
  }
}
