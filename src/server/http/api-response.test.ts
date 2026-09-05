import { describe, expect, it } from "vitest";
import { z } from "zod";

import { reportServerError } from "@/server/observability/server-logger";

import { apiErrorResponseSchema } from "@/shared/contracts/error";

import { AppError } from "../errors/app-error";

import { jsonResponse, parseJsonRequest, toErrorResponse } from "./api-response";

vi.mock("@/server/observability/server-logger", () => ({ reportServerError: vi.fn() }));

const mockedReportServerError = vi.mocked(reportServerError);

describe("toErrorResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns safe field errors for invalid request input", async () => {
    const schema = z.object({ title: z.string().min(1, "제목을 입력해 주세요.") });
    const error = schema.safeParse({ title: "" }).error;

    const response = toErrorResponse(error);
    const body = apiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: "VALIDATION_ERROR",
      message: "입력값이 올바르지 않습니다.",
      details: { fieldErrors: { title: ["제목을 입력해 주세요."] } },
    });
    expect(mockedReportServerError).not.toHaveBeenCalled();
  });

  it("does not expose internal AppError details", async () => {
    const response = toErrorResponse(
      new AppError("SONG_NOT_FOUND", { sql: "select secret", row: { password: "secret" } }),
    );

    expect(apiErrorResponseSchema.parse(await response.json())).toEqual({
      code: "SONG_NOT_FOUND",
      message: "곡을 찾을 수 없습니다.",
    });
    expect(mockedReportServerError).not.toHaveBeenCalled();
  });

  it("treats malformed JSON as a request validation failure", async () => {
    const request = new Request("https://example.test/api", {
      body: "{broken",
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const error = await parseJsonRequest(request, z.object({ title: z.string() })).catch(
      (cause: unknown) => cause,
    );
    const response = toErrorResponse(error);

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json())).toEqual({
      code: "VALIDATION_ERROR",
      message: "요청 본문이 올바른 JSON 형식이 아닙니다.",
    });
    expect(mockedReportServerError).not.toHaveBeenCalled();
  });

  it("captures an unexpected error with a safe event and keeps the generic 500 body", async () => {
    const error = new Error("SQL_MARKER", { cause: { params: ["PASSWORD_HASH_MARKER"] } });

    const response = toErrorResponse(error);

    expect(response.status).toBe(500);
    expect(apiErrorResponseSchema.parse(await response.json())).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    });
    expect(mockedReportServerError).toHaveBeenCalledWith(error, {
      event: "api.unexpected_error",
      source: "api-route-handler",
    });
  });

  it("captures output contract failure without retaining invalid output details", async () => {
    const schema = z.object({ id: z.number() });
    let error: unknown;
    try {
      jsonResponse(schema, { id: "PRIVATE_OUTPUT_MARKER" });
    } catch (caught) {
      error = caught;
    }

    const response = toErrorResponse(error);

    expect(response.status).toBe(500);
    expect(mockedReportServerError).toHaveBeenCalledWith(
      expect.objectContaining({ name: "OutputContractError" }),
      {
        event: "api.output_contract_violation",
        source: "api-route-handler",
        error: { type: "output-contract", code: "OUTPUT_CONTRACT_VIOLATION" },
      },
    );
    expect(JSON.stringify(mockedReportServerError.mock.calls)).not.toContain(
      "PRIVATE_OUTPUT_MARKER",
    );
  });
});
