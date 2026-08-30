import { createMongoAbility, type MongoAbility } from "@casl/ability";

export type AppAbility = MongoAbility<[string, string]>;

/** 실제 정책은 M5 CASL policy checkpoint에서 추가한다. */
export function createEmptyAbility(): AppAbility {
  return createMongoAbility<[string, string]>([]);
}
