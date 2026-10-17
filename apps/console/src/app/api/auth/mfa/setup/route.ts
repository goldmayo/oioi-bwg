import { handleConsoleMfaEnrollment } from "@/server/http/console-mfa-enrollment";

export async function POST(request: Request) {
  return handleConsoleMfaEnrollment(request, "setup");
}
