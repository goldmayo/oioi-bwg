import "server-only";

import { v7 } from "uuid";

export function createEntityId(): string {
  return v7();
}
