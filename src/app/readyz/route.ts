import { sql } from "drizzle-orm";

import { getDatabase } from "@/server/db";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await getDatabase().execute(sql`select 1`);

    return Response.json({ status: "ready" }, { headers });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
