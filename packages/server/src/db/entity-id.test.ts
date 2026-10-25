import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";

import { createEntityId } from "./entity-id";

it("issues distinct canonical UUIDv7 values in the current timestamp range", () => {
  const before = Date.now();
  const ids = Array.from({ length: 1000 }, () => createEntityId());
  const after = Date.now();
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(entityIdSchema.parse(id)).toBe(id);
    const timestamp = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  }
});
