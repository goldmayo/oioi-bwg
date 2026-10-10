import { createRequire } from "node:module";

import { getDatabase } from "@oioi-bwg/server/db";
import { setupConsoleMfa, confirmConsoleMfa } from "@oioi-bwg/server/services/console-mfa-service";

// 기존 격리 runner가 만든 DB에만 사전 등록한다. 일반 runtime/운영 seed가 아니다.
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname))
  throw new Error("Refusing non-isolated MFA fixture database");
const key = Buffer.alloc(32, 9);
const email = process.argv[2]!;
const { generateSync } = createRequire(
  new URL("../../packages/server/package.json", import.meta.url),
)("otplib");
try {
  const pending = await setupConsoleMfa(email, "P04-fixture-pass1!", key);
  const otp = generateSync({ secret: pending.secret, epoch: Math.floor(Date.now() / 1000) - 30 });
  await confirmConsoleMfa(email, "P04-fixture-pass1!", otp, pending.version, key);
  // 부모 smoke process가 pipe로 받아 memory에만 보관한다. artifact/log에는 기록하지 않는다.
  process.stdout.write(JSON.stringify(pending));
} finally {
  await getDatabase().$client.end();
}
