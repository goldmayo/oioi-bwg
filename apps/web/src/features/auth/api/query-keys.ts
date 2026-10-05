/** RSC seed와 Client Query가 공유하는 ability cache identity다. */
export const authAbilityQueryKeys = {
  all: ["auth"] as const,
  ability: () => [...authAbilityQueryKeys.all, "ability"] as const,
};
