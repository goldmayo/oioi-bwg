import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
  type RawRuleOf,
} from "@casl/ability";

import { APP_ACTIONS, APP_SUBJECTS } from "@/shared/contracts/authorization";

import type { AccountRole } from "../db/schema";

export { APP_ACTIONS, APP_SUBJECTS } from "@/shared/contracts/authorization";

export type AppAction = (typeof APP_ACTIONS)[number];
export type AppSubjectName = (typeof APP_SUBJECTS)[number];
export type AppSubject = AppSubjectName | { accountId?: string; authorAccountId?: string };
export type AuthorizationFacts = {
  accountId: string | null;
  role: AccountRole | null;
};

export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

const PUBLIC_SUBJECTS: AppSubjectName[] = [
  "Artist",
  "Song",
  "CheerGuide",
  "Revision",
  "DiscussionThread",
  "DiscussionComment",
  "PerformanceSchedule",
];

/** authorization facts에 따라 서버에서 사용할 CASL rule 목록을 생성한다. */
export function buildAbilityRules(facts: AuthorizationFacts): RawRuleOf<AppAbility>[] {
  const { can, rules } = new AbilityBuilder<AppAbility>(createMongoAbility);

  can("read", PUBLIC_SUBJECTS);

  if (!facts.role || !facts.accountId) return rules;

  can("create", ["Contribution", "DiscussionThread", "DiscussionComment", "Report"]);
  can("update", "Profile", { accountId: facts.accountId });
  can("connect", "OAuthIdentity", { accountId: facts.accountId });
  can("disconnect", "OAuthIdentity", { accountId: facts.accountId });
  can("update", "DiscussionComment", { authorAccountId: facts.accountId });
  can("delete", "DiscussionComment", { authorAccountId: facts.accountId });

  if (facts.role === "REVIEWER" || facts.role === "ADMIN") {
    can(["resolve", "reject", "review", "carryOver"], "DiscussionThread");
  }

  if (facts.role === "ADMIN") {
    can("manage", "all");
  }

  return rules;
}

export function createEmptyAbility(): AppAbility {
  return createMongoAbility<AppAbility>([]);
}

/** authorization facts를 CASL ability로 컴파일한다. */
export function buildAbility(facts: AuthorizationFacts): AppAbility {
  return createMongoAbility<AppAbility>(buildAbilityRules(facts));
}
