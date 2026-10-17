import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJsonRequest, toErrorResponse } from "./api-response";
import { assertConsoleOrigin } from "./console-origin";

const origin = "http://127.0.0.1:3001";
describe("Console mutation Origin", () => {
  it.each([
    undefined,
    "null",
    "http://127.0.0.1:3000",
    "https://evil.test",
    `${origin}/`,
    `${origin}.evil.test`,
  ])("누락 또는 다른 Origin %s를 거절한다", (value) => {
    const headers = new Headers(value === undefined ? {} : { Origin: value });
    expect(() => assertConsoleOrigin(headers)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });
  it("설정 Origin을 정확히 허용한다", () => {
    expect(() => assertConsoleOrigin(new Headers({ Origin: origin }))).not.toThrow();
  });
  it.each([undefined, "text/plain", "application/x-www-form-urlencoded"])(
    "JSON content-type %s를 거절한다",
    async (contentType) => {
      const headers = new Headers({ Origin: origin });
      if (contentType) headers.set("content-type", contentType);
      const request = new Request(`${origin}/api/admin/songs`, {
        method: "POST",
        headers,
        body: '{"title":"test"}',
      });
      const error = await parseJsonRequest(request, z.object({ title: z.string() })).catch(
        (cause: unknown) => cause,
      );
      expect(toErrorResponse(error).status).toBe(400);
    },
  );
});
