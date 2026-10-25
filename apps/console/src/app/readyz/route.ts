import { parseAdminMfaKey } from "@oioi-bwg/server/auth/admin-mfa-crypto";
import { getDatabase } from "@oioi-bwg/server/db";
import { getPublicAssetConfig } from "@oioi-bwg/server/storage/upload-public-asset";
import { sql } from "drizzle-orm";

import { getConsoleRuntimeConfig } from "@/shared/config/console-runtime";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    // 외부 R2 요청 없이 필수 설정을 검사하고 사용자/MFA 상태를 변경하지 않는다.
    getConsoleRuntimeConfig();
    parseAdminMfaKey(process.env.CONSOLE_MFA_ENCRYPTION_KEY ?? "");
    getPublicAssetConfig();
    await getDatabase().execute(sql`select 1`);
    return Response.json({ status: "ready" }, { headers });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
