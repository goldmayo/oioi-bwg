import { subject } from "@casl/ability";
import { describe, expect, it } from "vitest";

import { buildAbility } from "./ability";

describe("CASL authorization rules", () => {
  it("allows public reads to guests but no writes", () => {
    const ability = buildAbility({ accountId: null, role: null });

    expect(ability.can("read", "Song")).toBe(true);
    expect(ability.can("read", "DiscussionThread")).toBe(true);
    expect(ability.can("create", "Contribution")).toBe(false);
  });

  it("allows USER contribution and own comment management only", () => {
    const ability = buildAbility({
      accountId: "019a0170-0000-7000-8000-00000000002a",
      role: "USER",
    });

    expect(ability.can("create", "Contribution")).toBe(true);
    expect(
      ability.can(
        "update",
        subject("DiscussionComment", { authorAccountId: "019a0170-0000-7000-8000-00000000002a" }),
      ),
    ).toBe(true);
    expect(
      ability.can(
        "update",
        subject("DiscussionComment", { authorAccountId: "019a0170-0000-7000-8000-000000000007" }),
      ),
    ).toBe(false);
    expect(ability.can("resolve", "DiscussionThread")).toBe(false);
  });

  it("allows REVIEWER thread decisions but not final revision decisions", () => {
    const ability = buildAbility({
      accountId: "019a0170-0000-7000-8000-00000000002a",
      role: "REVIEWER",
    });

    expect(ability.can("resolve", "DiscussionThread")).toBe(true);
    expect(ability.can("reject", "DiscussionThread")).toBe(true);
    expect(ability.can("carryOver", "DiscussionThread")).toBe(true);
    expect(ability.can("approve", "Revision")).toBe(false);
    expect(ability.can("suspend", "Account")).toBe(false);
  });

  it("allows ADMIN management across the policy subjects", () => {
    const ability = buildAbility({
      accountId: "019a0170-0000-7000-8000-00000000002a",
      role: "ADMIN",
    });

    expect(ability.can("approve", "Revision")).toBe(true);
    expect(ability.can("suspend", "Account")).toBe(true);
    expect(ability.can("override", "PerformanceSchedule")).toBe(true);
  });
});
