import { describe, expect, it } from "vitest";
import { z } from "zod";

import { apiErrorResponseSchema } from "@/shared/contracts/error";

import { AppError } from "../errors/app-error";

import { parseJsonRequest, toErrorResponse } from "./api-response";

describe("toErrorResponse", () => {
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
  });

  it("does not expose internal AppError details", async () => {
    const response = toErrorResponse(
      new AppError("SONG_NOT_FOUND", { sql: "select secret", row: { password: "secret" } }),
    );

    expect(apiErrorResponseSchema.parse(await response.json())).toEqual({
      code: "SONG_NOT_FOUND",
      message: "곡을 찾을 수 없습니다.",
    });
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
  });
});
