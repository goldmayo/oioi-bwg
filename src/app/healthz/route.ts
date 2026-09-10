export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  return Response.json({ status: "ok" }, { headers });
}
