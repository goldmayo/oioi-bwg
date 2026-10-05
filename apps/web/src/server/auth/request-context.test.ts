import { describe, expect, it, vi } from "vitest";

import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import { findAuthorizationFactsByAccountId } from "../repositories/auth-repository";

import { getRequestContext, requireUser } from "./request-context";

import { auth } from "@/auth";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("../db", () => ({ getDatabase: vi.fn() }));
vi.mock("../repositories/auth-repository", () => ({
  findAuthorizationFactsByAccountId: vi.fn(),
}));

const mockedAuth = vi.mocked(auth as unknown as () => Promise<{ user: { id: string } } | null>);
const mockedGetDatabase = vi.mocked(getDatabase);
const mockedFindFacts = vi.mocked(findAuthorizationFactsByAccountId);

describe("getRequestContext", () => {
  it("returns a guest context when Auth.js has no identity", async () => {
    mockedAuth.mockResolvedValue(null);

    const context = await getRequestContext();

    expect(context.user).toBeNull();
    expect(context.ability.can("read", "Song")).toBe(true);
    expect(context.ability.can("create", "Contribution")).toBe(false);
    expect(mockedFindFacts).not.toHaveBeenCalled();
  });

  it("loads only active account authorization facts", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "42" } });
    mockedGetDatabase.mockReturnValue({} as never);
    mockedFindFacts.mockResolvedValue({ id: 42n, role: "ADMIN", status: "ACTIVE" });

    const context = await getRequestContext();

    expect(context.user).toEqual({ id: "42" });
    expect(mockedFindFacts).toHaveBeenCalledWith(expect.anything(), 42n);
  });

  it("turns invalid or inactive identities into guest context", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "not-a-bigint" } });
    await expect(getRequestContext()).resolves.toMatchObject({ user: null });

    mockedAuth.mockResolvedValue({ user: { id: "7" } });
    mockedFindFacts.mockResolvedValue({ id: 7n, role: "USER", status: "SUSPENDED" });
    await expect(getRequestContext()).resolves.toMatchObject({ user: null });
  });
});

describe("requireUser", () => {
  it("throws an UNAUTHENTICATED AppError for guests", () => {
    expect(() => requireUser({ user: null, ability: { can: () => false } as never })).toThrow(
      new AppError("UNAUTHENTICATED"),
    );
  });
});
