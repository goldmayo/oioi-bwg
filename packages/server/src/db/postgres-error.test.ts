import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vitest";

vi.mock("server-only", () => ({}));

import { isPostgresUniqueViolation } from "./postgres-error";

function postgresError(code: string, constraintName: string) {
  return Object.assign(new Error("database error"), {
    code,
    constraint_name: constraintName,
  });
}

function drizzleError(cause: Error) {
  return new DrizzleQueryError("insert into table values ($1)", ["PRIVATE_VALUE"], cause);
}

describe("isPostgresUniqueViolation", () => {
  it("matches an exact unique SQLSTATE and constraint on the direct Drizzle cause", () => {
    const error = drizzleError(postgresError("23505", "Album_slug_key"));

    expect(isPostgresUniqueViolation(error, "Album_slug_key")).toBe(true);
    expect(isPostgresUniqueViolation(error, "another_constraint_key")).toBe(false);
  });

  it("rejects a different SQLSTATE and a message-only match", () => {
    expect(
      isPostgresUniqueViolation(
        drizzleError(postgresError("23503", "Album_slug_key")),
        "Album_slug_key",
      ),
    ).toBe(false);
    expect(isPostgresUniqueViolation(new Error("23505 Album_slug_key"), "Album_slug_key")).toBe(
      false,
    );
  });

  it("does not recursively inspect nested causes", () => {
    const nested = new Error("wrapper", {
      cause: postgresError("23505", "Album_slug_key"),
    });

    expect(isPostgresUniqueViolation(drizzleError(nested), "Album_slug_key")).toBe(false);
  });

  it("returns false for missing, non-object, or throwing cause properties", () => {
    const throwingCause = Object.create(null, {
      code: {
        get() {
          throw new Error("unreadable");
        },
      },
    }) as Error;

    expect(isPostgresUniqueViolation(new DrizzleQueryError("select 1", [], undefined), "key")).toBe(
      false,
    );
    expect(
      isPostgresUniqueViolation(new DrizzleQueryError("select 1", [], "23505" as never), "key"),
    ).toBe(false);
    expect(
      isPostgresUniqueViolation(new DrizzleQueryError("select 1", [], throwingCause), "key"),
    ).toBe(false);
  });
});
