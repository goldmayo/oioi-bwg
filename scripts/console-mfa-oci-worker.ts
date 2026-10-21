import { executeOperatorRequest, operatorFailure } from "./console-mfa-execution";
import { OperatorError, parseOperatorArguments } from "./console-mfa-operator-policy";

// Only the reviewed host launcher calls this stdin worker; there is no HTTP entry point.
export async function run(input: unknown) {
  try {
    if (!input || typeof input !== "object") throw new OperatorError("INVALID_REQUEST");
    const data = input as Record<string, unknown>;
    if (
      Object.keys(data).sort().join() !== "args,scope,serverStartedAt" ||
      data.scope !== "oci-console" ||
      typeof data.serverStartedAt !== "string" ||
      !/^\d+\.\d{6}$/.test(data.serverStartedAt) ||
      !Array.isArray(data.args) ||
      data.args.length > 20 ||
      !data.args.every((v) => typeof v === "string" && v.length <= 128)
    )
      throw new OperatorError("INVALID_REQUEST");
    const request = parseOperatorArguments([...data.args, "--config", "-", "--reason-file", "-"]);
    const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== "postgres" ||
      (url.port && url.port !== "5432") ||
      url.pathname !== "/oioibawige" ||
      url.username !== "oioi_app" ||
      !url.password ||
      url.search ||
      url.hash
    )
      throw new OperatorError("DATABASE_TARGET_REJECTED");
    return await executeOperatorRequest(request, {
      databaseUrl: url.toString(),
      name: "oioibawige",
      role: "oioi_app",
      serverStartedAt: data.serverStartedAt,
    });
  } catch (error) {
    return { success: false, code: operatorFailure(error) };
  }
}
