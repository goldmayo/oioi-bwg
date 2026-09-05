import "server-only";

import { DrizzleQueryError } from "drizzle-orm/errors";

function readProperty(value: unknown, key: PropertyKey): unknown {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return undefined;
  }

  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

/** 확인된 Drizzle direct cause의 known PostgreSQL unique violation만 판별한다. */
export function isPostgresUniqueViolation(error: unknown, constraintName: string): boolean {
  try {
    if (!(error instanceof DrizzleQueryError)) return false;
  } catch {
    return false;
  }

  const cause = readProperty(error, "cause");
  return (
    readProperty(cause, "code") === "23505" &&
    readProperty(cause, "constraint_name") === constraintName
  );
}
