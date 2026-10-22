import { getDatabase } from "@oioi-bwg/server/db";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { findConsoleAuthorizationFacts } from "@oioi-bwg/server/repositories/admin-mfa-repository";
import { describe, expect, it, vi } from "vitest";

import { getRequestAuthorization, getRequestContext, requireUser } from "./request-context";

import { auth } from "@/auth";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@oioi-bwg/server/db", () => ({ getDatabase: vi.fn() }));
const facts = vi.hoisted(() => vi.fn());
vi.mock("@oioi-bwg/server/repositories/admin-mfa-repository", () => ({
  findConsoleAuthorizationFacts: facts,
}));

const mockedAuth = vi.mocked(
  auth as unknown as () => Promise<{
    user: { id: string; mfaVerified?: unknown; mfaVersion?: unknown };
  } | null>,
);
const mockedGetDatabase = vi.mocked(getDatabase);
const mockedFindFacts = vi.mocked(findConsoleAuthorizationFacts);

describe("getRequestContext", () => {
  it("rejects password-only, invalid proof, reset and revoked MFA sessions", async () => {
    mockedFindFacts.mockClear();
    for (const proof of [
      {},
      { mfaVerified: false, mfaVersion: 1 },
      { mfaVerified: true, mfaVersion: "1" },
    ]) {
      mockedAuth.mockResolvedValue({ user: { id: "42", ...proof } });
      await expect(getRequestContext()).resolves.toMatchObject({ user: null });
    }
    expect(mockedFindFacts).not.toHaveBeenCalled();
    mockedAuth.mockResolvedValue({ user: { id: "42", mfaVerified: true, mfaVersion: 1 } });
    for (const mfa of [
      { enabledAt: null, version: 1 },
      { enabledAt: "2026-10-10T00:00:00Z", version: 2 },
    ]) {
      mockedFindFacts.mockResolvedValue({ id: 42n, role: "ADMIN", status: "ACTIVE", ...mfa });
      await expect(getRequestContext()).resolves.toMatchObject({ user: null });
    }
    mockedFindFacts.mockClear();
  });
  it("returns a guest context when Auth.js has no identity", async () => {
    mockedAuth.mockResolvedValue(null);

    const context = await getRequestContext();

    expect(context.user).toBeNull();
    expect(context.ability.can("read", "Song")).toBe(true);
    expect(context.ability.can("create", "Contribution")).toBe(false);
    expect(mockedFindFacts).not.toHaveBeenCalled();
  });

  it("loads only active account authorization facts", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "42", mfaVerified: true, mfaVersion: 1 } });
    mockedGetDatabase.mockReturnValue({} as never);
    mockedFindFacts.mockResolvedValue({
      id: 42n,
      role: "ADMIN",
      status: "ACTIVE",
      enabledAt: "2026-10-10T00:00:00Z",
      version: 1,
    });

    const context = await getRequestContext();

    expect(context.user).toEqual({ id: "42" });
    expect(mockedFindFacts).toHaveBeenCalledWith(expect.anything(), 42n);
  });

  it("turns invalid or inactive identities into guest context", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "not-a-bigint", mfaVerified: true, mfaVersion: 1 },
    });
    await expect(getRequestContext()).resolves.toMatchObject({ user: null });

    mockedAuth.mockResolvedValue({ user: { id: "7", mfaVerified: true, mfaVersion: 1 } });
    mockedFindFacts.mockResolvedValue({
      id: 7n,
      role: "USER",
      status: "SUSPENDED",
      enabledAt: "2026-10-10T00:00:00Z",
      version: 1,
    });
    await expect(getRequestContext()).resolves.toMatchObject({ user: null });
  });
  it.each(["USER", "REVIEWER"] as const)(
    "revokes Console access on demotion to %s",
    async (role) => {
      mockedAuth.mockResolvedValue({ user: { id: "42", mfaVerified: true, mfaVersion: 1 } });
      mockedFindFacts.mockResolvedValue({
        id: 42n,
        role,
        status: "ACTIVE",
        enabledAt: "2026-10-10T00:00:00Z",
        version: 1,
      });
      await expect(getRequestContext()).resolves.toMatchObject({ user: null });
    },
  );
});

describe("requireUser", () => {
  it("throws an UNAUTHENTICATED AppError for guests", () => {
    expect(() => requireUser({ user: null, ability: { can: () => false } as never })).toThrow(
      new AppError("UNAUTHENTICATED"),
    );
  });
});

describe("AUTH-009 safe authorization decisions", () => {
  it.each([
    ["identity", "no_valid_identity", 0],
    ["proof", "mfa_proof_missing", 0],
    ["id", "invalid_identity", 0],
    ["missing", "authorization_facts_missing", 1],
    ["inactive", "account_inactive", 1],
    ["role", "admin_role_required", 1],
    ["disabled", "mfa_disabled", 1],
    ["version", "mfa_version_mismatch", 1],
    ["authorized", "authorized", 1],
  ] as const)("keeps %s separate without additional DB reads", async (mode, decision, reads) => {
    mockedAuth.mockResolvedValue(
      mode === "identity"
        ? null
        : {
            user: {
              id: mode === "id" ? "0" : "42",
              mfaVerified: mode !== "proof",
              mfaVersion: 1,
            },
          },
    );
    facts.mockClear();
    facts.mockResolvedValue(
      mode === "missing"
        ? undefined
        : {
            id: 42n,
            role: mode === "role" ? "USER" : "ADMIN",
            status: mode === "inactive" ? "SUSPENDED" : "ACTIVE",
            enabledAt: mode === "disabled" ? null : "2026-10-10T00:00:00Z",
            version: mode === "version" ? 2 : 1,
          },
    );
    const state = await getRequestAuthorization();
    expect(state.decision).toBe(decision);
    expect(state.context.user !== null).toBe(mode === "authorized");
    expect(facts).toHaveBeenCalledTimes(reads);
    expect(state.context).not.toHaveProperty("decision");
  });

  it("keeps a facts database failure as the original exception", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "42", mfaVerified: true, mfaVersion: 1 } });
    const error = new Error("database outage");
    facts.mockRejectedValueOnce(error);
    await expect(getRequestAuthorization()).rejects.toBe(error);
  });
});
