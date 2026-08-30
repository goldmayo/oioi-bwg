"use client";

import { createMongoAbility, type MongoAbility } from "@casl/ability";

import type { SerializedAbilityRule } from "@/shared/contracts/authorization";

export type ClientAbility = MongoAbility<
  [string, string | { accountId?: string; authorAccountId?: string }]
>;

/** 서버가 직렬화한 CASL rules를 client UI gating용 ability로 구성한다. */
export function createClientAbility(rules: SerializedAbilityRule[]): ClientAbility {
  return createMongoAbility<ClientAbility>(rules);
}
