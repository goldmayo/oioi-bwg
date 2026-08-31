import { createQueryKeys } from "@lukemorales/query-key-factory";

/** RSC seed와 Client Query가 공유하는 현재 CASL ability cache identity다. */
export const authAbilityQueryKeys = createQueryKeys("auth", {
  ability: null,
});
