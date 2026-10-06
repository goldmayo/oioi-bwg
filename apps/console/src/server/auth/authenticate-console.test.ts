import { getDatabase } from "@oioi-bwg/server/db";
import { findAuthorizationFactsByAccountId } from "@oioi-bwg/server/repositories/auth-repository";
import { authenticateCredentials } from "@oioi-bwg/server/services/authentication-service";
import { describe, expect, it, vi } from "vitest";

import { authenticateConsole } from "./authenticate-console";

vi.mock("@oioi-bwg/server/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@oioi-bwg/server/repositories/auth-repository", () => ({
  findAuthorizationFactsByAccountId: vi.fn(),
}));
vi.mock("@oioi-bwg/server/services/authentication-service", () => ({
  authenticateCredentials: vi.fn(),
}));

describe("Console identity issuance", () => {
  it("does not load authorization facts after rejected credentials", async () => {
    vi.mocked(authenticateCredentials).mockResolvedValue(null);
    vi.mocked(findAuthorizationFactsByAccountId).mockClear();
    expect(await authenticateConsole("admin@example.test", "invalid")).toBeNull();
    expect(findAuthorizationFactsByAccountId).not.toHaveBeenCalled();
  });
  it.each(["USER", "REVIEWER", "ADMIN"] as const)(
    "allows only ACTIVE ADMIN, role %s",
    async (role) => {
      vi.mocked(authenticateCredentials).mockResolvedValue({ id: "42" });
      vi.mocked(getDatabase).mockReturnValue({} as never);
      vi.mocked(findAuthorizationFactsByAccountId).mockResolvedValue({
        id: 42n,
        role,
        status: "ACTIVE",
      });
      expect(await authenticateConsole("admin@example.test", "test-password")).toEqual(
        role === "ADMIN" ? { id: "42" } : null,
      );
    },
  );
  it("rejects administrators deactivated between password and role checks", async () => {
    vi.mocked(authenticateCredentials).mockResolvedValue({ id: "42" });
    vi.mocked(findAuthorizationFactsByAccountId).mockResolvedValue({
      id: 42n,
      role: "ADMIN",
      status: "SUSPENDED",
    });
    expect(await authenticateConsole("admin@example.test", "test-password")).toBeNull();
  });
});
