import { describe, expect, it } from "vitest";

import { entityIdSchema } from "./entity-id";

describe("UUIDv7 domain identity", () => {
  it("normalizes UUID text to one cache/lookup representation", () => {
    expect(entityIdSchema.parse("019A0170-0000-7000-8000-000000000ABC")).toBe(
      "019a0170-0000-7000-8000-000000000abc",
    );
  });

  it.each([
    1,
    "1",
    "",
    " 019a0170-0000-7000-8000-000000000001",
    "00000000-0000-0000-0000-000000000000",
    "019a0170-0000-4000-8000-000000000001",
    "019a0170-0000-7000-0000-000000000001",
  ])("rejects numeric, malformed, and non-v7 identifiers: %s", (value) =>
    expect(entityIdSchema.safeParse(value).success).toBe(false),
  );
});
